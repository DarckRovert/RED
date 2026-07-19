/**
 * RED MeshRouter — Multi-transport, multi-hop mesh networking coordinator.
 *
 * Architecture:
 *   Each RED device is a full mesh node. When it receives a packet NOT addressed
 *   to itself, it relays the packet to ALL its connected peers (flood routing).
 *   When it receives a packet addressed to itself, it delivers it to the Rust node.
 *
 * Transport priority (fastest/most reliable first):
 *   1. WiFi Direct (WebRTC DataChannel) — ~54 Mbps, ~30ms latency
 *   2. Bluetooth LE (GATT)              — ~1 Mbps, ~100ms latency
 *   3. LoRa radio (via serial bridge)   — ~50 Kbps, ~500ms latency
 *
 * Routing algorithm: Controlled Flood (CF)
 *   - Every packet has a TTL (starts at 20 hops)
 *   - Each relay decrements TTL; drops packet at TTL=0
 *   - Deduplication via 72h seen-nonce window prevents loops
 *   - No routing tables required — works in fully dynamic topologies
 */

import { bluetoothTransport } from './bluetoothTransport';
import { WifiDirectTransport } from './wifiDirectTransport';
import {
  MeshPacket,
  createPacket,
  decode,
  encode,
  relay,
} from './meshProtocol';

import { RedAPI } from '../api';

const DEDUP_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
const MAX_DEDUP_CACHE = 50_000;

export interface MeshPeer {
  id: string;          // Short node ID or BLE device ID
  transport: 'wifi' | 'ble' | 'lora';
  lastSeen: number;    // Unix ms
  rssi?: number;       // Signal strength (BLE only)
}

export type MeshMessageHandler = (packet: MeshPacket) => void;

class MeshRouter {
  private myIdentityHash: string = '';
  private wifi: WifiDirectTransport | null = null;

  /** Nonces of recently seen packets — prevents relay loops */
  private seenNonces: Map<string, number> = new Map(); // nonce → timestamp

  /** Known peers across all transports */
  public peers: Map<string, MeshPeer> = new Map();

  /** Listeners for packets addressed to THIS node */
  private localDeliveryHandlers: MeshMessageHandler[] = [];

  /** Offline store-and-forward queue: packets waiting for a route */
  private pendingQueue: Array<{ packet: MeshPacket; expiresAt: number }> = [];

  private initialized = false;

  // ─── Initialization ─────────────────────────────────────────────────────────

  init(myIdentityHash: string) {
    if (this.initialized) return;
    this.myIdentityHash = myIdentityHash;
    this.wifi = new WifiDirectTransport(myIdentityHash);
    this.initialized = true;

    // Receive from BLE
    bluetoothTransport.onMessage(({ from, payload }) => {
      this.updatePeer(from, 'ble');
      this.handleRawPacket(payload); // fire-and-forget; handles its own errors
    });

    // Receive from WiFi Direct DataChannel
    this.wifi.onMessage(({ from, payload }) => {
      this.updatePeer(from, 'wifi');
      this.handleRawPacket(payload); // fire-and-forget; handles its own errors
    });

    console.log('[MeshRouter] Initialized — identity:', myIdentityHash.slice(0, 12));
  }

  async start() {
    if (!this.wifi) return;

    // Connect to local WebRTC signaling
    try {
      await this.wifi.connectToLocalSignaling();
      console.log('[MeshRouter] WiFi signaling connected');
    } catch (e) {
      console.warn('[MeshRouter] No WiFi signaling available (ok if offline):', e);
    }

    // Schedule dedup cache purge every 5 minutes
    setInterval(() => this.purgeDedup(), 5 * 60 * 1000);

    // Retry pending queue every 10 seconds
    setInterval(() => this.flushPendingQueue(), 10_000);
  }

  // ─── Sending ────────────────────────────────────────────────────────────────

  /**
   * Send a payload to a specific recipient identity hash.
   * If no direct path exists, the packet enters the store-and-forward queue
   * and will be delivered as soon as any peer connects that can relay it.
   */
  async send(recipientHash: string, payload: Uint8Array): Promise<'sent' | 'queued' | 'failed'> {
    const packet = createPacket(this.myIdentityHash, recipientHash, payload);
    return this.forwardPacket(packet, null);
  }

  /**
   * Broadcast a raw payload to ALL connected peers (mesh flood).
   * Used internally for relay; also exposed for the Rust node to inject mesh traffic.
   */
  async broadcast(payload: Uint8Array, exceptPeer?: string): Promise<number> {
    let sent = 0;
    for (const [peerId, peer] of this.peers) {
      if (peerId === exceptPeer) continue;
      const ok = await this.sendToPeer(peerId, peer.transport, payload);
      if (ok) sent++;
    }
    return sent;
  }

  // ─── Receiving & Relaying ───────────────────────────────────────────────────

  private async handleRawPacket(raw: Uint8Array) {
    const packet = decode(raw);
    if (!packet) {
      console.warn('[MeshRouter] Received malformed packet, ignoring');
      return;
    }

    // Dedup check
    if (this.isDuplicate(packet.nonce)) {
      return; // Already seen this packet — drop silently
    }
    this.markSeen(packet.nonce);

    if (packet.recipient === this.myIdentityHash) {
      // ── FINAL DELIVERY: packet is for us ──
      console.log(`[MeshRouter] Packet delivered locally from ${packet.sender.slice(0, 8)}`);
      this.deliverToRustNode(packet);
      this.localDeliveryHandlers.forEach(h => h(packet));
    } else {
      // ── RELAY: packet is for someone else — forward it ──
      const forwarded = relay(packet);
      if (forwarded) {
        console.log(`[MeshRouter] Relaying packet → ${packet.recipient.slice(0, 8)} (TTL ${forwarded.ttl})`);
        const encoded = encode(forwarded);
        // await ensures back-pressure: if all peers are busy we don't flood the queue
        await this.broadcast(encoded);
      } else {
        console.log('[MeshRouter] Packet TTL exhausted — dropped');
      }
    }
  }

  private async forwardPacket(
    packet: MeshPacket,
    exceptPeer: string | null
  ): Promise<'sent' | 'queued' | 'failed'> {
    const encoded = encode(packet);
    const peersToSend = Array.from(this.peers.entries())
      .filter(([id]) => id !== exceptPeer);

    if (peersToSend.length === 0) {
      // No peers connected — queue for later
      this.pendingQueue.push({
        packet,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h TTL
      });
      console.log(`[MeshRouter] No peers — queued packet for ${packet.recipient.slice(0, 8)}`);
      return 'queued';
    }

    let anySent = false;
    for (const [peerId, peer] of peersToSend) {
      const ok = await this.sendToPeer(peerId, peer.transport, encoded);
      if (ok) anySent = true;
    }

    return anySent ? 'sent' : 'failed';
  }

  private async sendToPeer(
    peerId: string,
    transport: 'wifi' | 'ble' | 'lora',
    payload: Uint8Array
  ): Promise<boolean> {
    try {
      if (transport === 'wifi' && this.wifi) {
        return await this.wifi.send(peerId, payload);
      }
      if (transport === 'ble') {
        return await bluetoothTransport.send(peerId, payload);
      }
      // LoRa: route via Rust serial bridge
      if (transport === 'lora') {
        return await this.sendViaLoRa(payload);
      }
    } catch (e) {
      console.warn(`[MeshRouter] Send to ${peerId} via ${transport} failed:`, e);
    }
    return false;
  }

  private async sendViaLoRa(payload: Uint8Array): Promise<boolean> {
    // LoRa packets are routed through the Rust lora_bridge via the REST API
    // The Rust node will serialize and write to the serial port
    try {
      const hex = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join('');
      await RedAPI.injectMeshPayload(hex, true);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Rust Node Integration ───────────────────────────────────────────────────

  /**
   * Inject a received mesh packet into the local Rust node for decryption
   * and delivery to the user.
   */
  private async deliverToRustNode(packet: MeshPacket) {
    const hex = Array.from(packet.payload)
      .map(b => b.toString(16).padStart(2, '0')).join('');
    try {
      await RedAPI.injectMeshPayload(hex);
    } catch (e) {
      console.error('[MeshRouter] Failed to deliver to Rust node:', e);
    }
  }

  // ─── Store-and-Forward Queue ─────────────────────────────────────────────────

  private async flushPendingQueue() {
    if (this.pendingQueue.length === 0) return;
    if (this.peers.size === 0) return;

    const now = Date.now();
    const toRetry = this.pendingQueue.filter(p => p.expiresAt > now);
    this.pendingQueue = [];

    let retried = 0;
    for (const { packet } of toRetry) {
      const result = await this.forwardPacket(packet, null);
      if (result === 'queued') {
        // Put back in queue
        this.pendingQueue.push({ packet, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      }
      retried++;
    }

    if (retried > 0) {
      console.log(`[MeshRouter] Flushed ${retried} queued packets`);
    }
  }

  // ─── Peer Management ─────────────────────────────────────────────────────────

  addWifiPeer(peerId: string) {
    this.updatePeer(peerId, 'wifi');
    this.flushPendingQueue();
  }

  addBlePeer(deviceId: string, rssi?: number) {
    this.updatePeer(deviceId, 'ble', rssi);
    this.flushPendingQueue();
  }

  addLoraPeer(peerId: string) {
    this.updatePeer(peerId, 'lora');
    this.flushPendingQueue();
  }

  removePeer(peerId: string) {
    this.peers.delete(peerId);
  }

  private updatePeer(id: string, transport: 'wifi' | 'ble' | 'lora', rssi?: number) {
    const existing = this.peers.get(id);
    // Upgrade transport if better one found
    const priority = { wifi: 3, ble: 2, lora: 1 };
    const newPriority = priority[transport];
    const existingPriority = existing ? priority[existing.transport] : 0;

    this.peers.set(id, {
      id,
      transport: newPriority > existingPriority ? transport : (existing?.transport ?? transport),
      lastSeen: Date.now(),
      rssi,
    });
  }

  getPeerList(): MeshPeer[] {
    return Array.from(this.peers.values())
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  get peerCount(): number {
    return this.peers.size;
  }

  get wifiPeerCount(): number {
    return Array.from(this.peers.values()).filter(p => p.transport === 'wifi').length;
  }

  get blePeerCount(): number {
    return Array.from(this.peers.values()).filter(p => p.transport === 'ble').length;
  }

  get loraPeerCount(): number {
    return Array.from(this.peers.values()).filter(p => p.transport === 'lora').length;
  }

  // ─── Deduplication ────────────────────────────────────────────────────────────

  private isDuplicate(nonce: string): boolean {
    return this.seenNonces.has(nonce);
  }

  private markSeen(nonce: string) {
    this.seenNonces.set(nonce, Date.now());
    if (this.seenNonces.size > MAX_DEDUP_CACHE) {
      // Evict oldest entries
      const oldest = Array.from(this.seenNonces.entries())
        .sort(([, a], [, b]) => a - b)
        .slice(0, 1000)
        .map(([k]) => k);
      oldest.forEach(k => this.seenNonces.delete(k));
    }
  }

  private purgeDedup() {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [nonce, ts] of this.seenNonces) {
      if (ts < cutoff) this.seenNonces.delete(nonce);
    }
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────────

  onLocalDelivery(handler: MeshMessageHandler) {
    this.localDeliveryHandlers.push(handler);
  }
}

/** Singleton mesh router instance */
export const meshRouter = new MeshRouter();

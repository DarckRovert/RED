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
 * Routing algorithm: Controlled Flood (CF) & Autonomous Gateway Bridge
 *   - Every packet has a TTL (starts at 20 hops)
 *   - Deduplication via 72h seen-nonce window prevents loops
 *   - Persistent DTN Store-and-Forward queue across app reboots/offline states
 *   - Cryptographic Delivery Acknowledgments (DELIVERY_ACK)
 *   - Autonomous Mesh-to-Internet Gateway (Edge Bridge Routing)
 */

import { bluetoothTransport } from './bluetoothTransport';
import { WifiDirectTransport } from './wifiDirectTransport';
import { mqttRelay } from './mqttRelayTransport';
import { networkWatcher, NetworkState } from './networkWatcher';
import { RED_VERSION } from '../version';
import { dtnStorage } from './dtnStorage';
import { loraBridge } from '../hardware/LoraSerialBridgeEngine';
import {
  MeshPacket,
  createPacket,
  decode,
  encode,
  relay,
} from './meshProtocol';

import { RedAPI } from '../api';
import { slottedGossip } from './SlottedGossipEngine';

const DEDUP_WINDOW_MS = 72 * 60 * 60 * 1000;     // 72h — control/protocol packets (replay prevention)
const DEDUP_WINDOW_MSG_MS = 30 * 60 * 1000;       // 30m  — chat messages (reduces Map size ~95% in long sessions)
const MAX_DEDUP_CACHE = 50_000;

/**
 * W6: Returns the appropriate deduplication window for a given nonce.
 * Control/protocol packets are long-lived (72h) to prevent replays across
 * reboots. Chat message packets only need a 30-minute window since the
 * dispatcher handles semantic deduplication independently.
 */
function dedupWindowFor(nonce: string): number {
  // Protocol packets are identified by a prefix that includes the type indicator
  // embedded by createPacket: nonces for DATA payloads start with 'pkt_'
  // Control nonces always contain a type string injected during creation.
  // As a safe heuristic: if the nonce has no embedded timestamp (pure hex),
  // treat it as a control nonce (72h). Otherwise use the short window.
  if (!nonce) return DEDUP_WINDOW_MS;
  // Hex-only nonces (e.g. from DELIVERY_ACK / identity payloads) — long window
  if (/^[0-9a-f]{16,}$/.test(nonce)) return DEDUP_WINDOW_MS;
  // Nonces with decimal timestamps embedded (msg_<ts>_...) — short window
  return DEDUP_WINDOW_MSG_MS;
}

/**
 * Normalizes any identity format (DID, short-id, MAC, with prefixes or uppercase)
 * into a clean lowercase 64-char or canonical identifier.
 */
export function normalizeIdentity(id: string): string {
  if (!id) return '';
  let clean = id.trim();
  if (clean.startsWith('did:red:')) {
    clean = clean.slice(8).trim();
  }
  // Check if it's a MAC address (e.g. 58:24:29:4F:33:1B or 58:24:29:4f:33:1b)
  if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(clean)) {
    return clean.toLowerCase();
  }
  if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts[0].length >= 16) {
      return parts[0].trim().toLowerCase();
    }
  }
  return clean.toLowerCase();
}

/**
 * Checks if two device names represent the same physical entity (fuzzy / substring matching)
 * while safely ignoring generic default names.
 */
export function isNameSimilar(name1?: string, name2?: string): boolean {
  if (!name1 || !name2) return false;
  const n1 = name1.trim().toLowerCase().replace(/^red-/, '');
  const n2 = name2.trim().toLowerCase().replace(/^red-/, '');
  if (!n1 || !n2) return false;
  const generic = ['dispositivo red', 'operador red', 'nodo', 'nuevo par', 'par malla', 'par escaneado', 'off-grid node'];
  if (generic.some(g => n1.startsWith(g)) || generic.some(g => n2.startsWith(g))) return false;
  if (n1 === n2) return true;
  // Substring or token overlap: e.g. "lenovo tab one" contains "tab"
  const tokens1 = n1.split(/[\s-_]+/).filter(t => t.length >= 3);
  const tokens2 = n2.split(/[\s-_]+/).filter(t => t.length >= 3);
  if (tokens1.some(t => tokens2.includes(t))) return true;
  if (n1.length >= 3 && n2.length >= 3 && (n1.includes(n2) || n2.includes(n1))) return true;
  return false;
}

/**
 * Generates a unique, deterministic message identifier for cross-transport idempotency.
 */
export function generateDeterministicMsgId(sender: string, recipient: string, content: string, timestamp?: number): string {
  const cleanSender = normalizeIdentity(sender).slice(0, 16);
  const cleanRecipient = normalizeIdentity(recipient).slice(0, 16);
  const ts = timestamp || Date.now();
  // Generate short alphanumeric hash from content
  let hash = 0;
  for (let i = 0; i < (content || '').length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  const contentCode = Math.abs(hash).toString(36);
  return `msg_${ts}_${cleanSender}_${cleanRecipient}_${contentCode}`;
}

export interface MeshPeer {
  id: string;          // Canonical node ID or hardware device ID
  canonicalId?: string; // Resolved canonical identity hash (64-char hex)
  name?: string;
  publicKey?: string;
  transport?: 'wifi' | 'ble' | 'lora' | string;
  transports?: ('wifi' | 'ble' | 'lora')[];
  lastSeen?: number;   // Unix ms
  rssi?: number;       // Signal strength (BLE only)
  lat?: number;
  lng?: number;
  isGateway?: boolean;
  hasInternet?: boolean;
  gatewayMetric?: number;
}

export type MeshMessageHandler = (packet: MeshPacket) => void;

interface PendingIdentityQuery {
  resolve: (info: { identity_hash: string; display_name: string; public_key?: string }) => void;
  reject: (err: any) => void;
  timer: any;
}

class MeshRouter {
  public myIdentityHash: string = '';
  public wifi: WifiDirectTransport | null = null;
  public hasInternetAccess = false;

  /** Nonces of recently seen packets — prevents relay loops (hydrated from localStorage) */
  private seenNonces: Map<string, number> = (() => {
    const map = new Map<string, number>();
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('red_seen_nonces');
        if (raw) {
          const list: [string, number][] = JSON.parse(raw);
          const cutoff = Date.now() - DEDUP_WINDOW_MS;
          for (const [k, v] of list) {
            if (v > cutoff) map.set(k, v);
          }
        }
      } catch {}
    }
    return map;
  })();

  /** Known peers across all transports (keyed by canonical ID or hardware ID) */
  public peers: Map<string, MeshPeer> = new Map();

  /** Discovered active Gateway nodes with Internet uplink access */
  public activeGateways: Map<string, MeshPeer> = new Map();

  /** Maps raw hardware device IDs (BLE MAC, WebRTC client IDs) to 64-char canonical identity_hash */
  public deviceToCanonicalMap: Map<string, string> = (() => {
    const map = new Map<string, string>();
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('red_device_canonical_map');
        if (raw) {
          const list: [string, string][] = JSON.parse(raw);
          for (const [k, v] of list) {
            if (k && v) map.set(k.toLowerCase(), v.toLowerCase());
          }
        }
      } catch {}
    }
    return map;
  })();

  private purgeInterval: any = null;
  private flushInterval: any = null;
  private isStarted = false;

  /** Pending identity query promises keyed by hardware device ID or sender hash */
  private pendingIdentityQueries: Map<string, PendingIdentityQuery[]> = new Map();

  /** Listeners for packets addressed to THIS node (Set prevents duplicate subscriber registrations) */
  private localDeliveryHandlers: Set<MeshMessageHandler> = new Set();

  /** Listeners notified when a hardware device ID is bound to a canonical 64-char DID */
  private identityResolvedListeners: Set<(info: { hardwareId: string; canonicalId: string; displayName: string; publicKey?: string }) => void> = new Set();

  /** Listeners for Shake-to-Pair P2P signals */
  private shakePairListeners: Set<(peer: { identity_hash: string; display_name: string; public_key?: string; timestamp: number }) => void> = new Set();

  private initialized = false;
  private unsubscribeNetwork: (() => void) | null = null;

  // ─── Initialization ─────────────────────────────────────────────────────────

  init(myIdentityHash: string) {
    if (this.initialized) {
      if (myIdentityHash && myIdentityHash !== this.myIdentityHash) {
        this.updateIdentity(myIdentityHash);
      }
      return;
    }
    this.myIdentityHash = myIdentityHash;
    this.wifi = new WifiDirectTransport(myIdentityHash);
    this.initialized = true;

    // Receive from BLE
    bluetoothTransport.onMessage(({ from, payload }) => {
      this.updatePeer(from, 'ble');
      this.handleRawPacket(payload, from, 'ble');
    });

    // Receive from WiFi Direct DataChannel / WebSocket Relay
    this.wifi.onMessage(({ from, payload }) => {
      this.updatePeer(from, 'wifi');
      this.handleRawPacket(payload, from, 'wifi');
    });

    // Receive from physical LoRa Serial / BLE bridge
    loraBridge.onPacketReceived((payload, rssi) => {
      this.updatePeer('lora-hardware-node', 'lora', rssi);
      this.handleRawPacket(payload, 'lora-hardware-node', 'lora');
    });

    // Initialize Network Watcher for automatic transitions (WiFi <-> 4G/5G <-> Offline)
    networkWatcher.init();
    this.hasInternetAccess = networkWatcher.hasInternet;

    this.unsubscribeNetwork = networkWatcher.onChange((state: NetworkState) => {
      this.handleNetworkChange(state);
    });

    console.log('[MeshRouter] Initialized — identity:', myIdentityHash.slice(0, 12));
  }

  public updateIdentity(newIdentityHash: string) {
    if (!newIdentityHash || newIdentityHash === this.myIdentityHash) return;
    console.log(`[MeshRouter] Updating identity: ${this.myIdentityHash?.slice(0, 8)} -> ${newIdentityHash.slice(0, 8)}`);
    this.myIdentityHash = newIdentityHash;
    if (this.wifi) {
      this.wifi.updateIdentity(newIdentityHash);
    } else {
      this.wifi = new WifiDirectTransport(newIdentityHash);
    }
  }

  async start() {
    if (!this.wifi || this.isStarted) return;
    this.isStarted = true;

    // Connect to local WebRTC signaling & global relays
    try {
      await this.wifi.connectToLocalSignaling();
      console.log('[MeshRouter] WiFi signaling connected');
    } catch (e) {
      console.warn('[MeshRouter] No WiFi signaling available (ok if offline):', e);
    }

    // Automatically flush pending DTN store-and-forward queue when MQTT connects/reconnects
    mqttRelay.onConnect(() => {
      console.log('[MeshRouter] Global MQTT relay active — flushing pending DTN queue');
      this.flushPendingQueue().catch(() => {});
    });

    // Schedule dedup cache purge every 5 minutes (clean previous if any)
    if (this.purgeInterval) clearInterval(this.purgeInterval);
    this.purgeInterval = setInterval(() => this.purgeDedup(), 5 * 60 * 1000);

    // Actively retry unacknowledged DTN pending packets every 6 seconds
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushInterval = setInterval(() => this.flushPendingQueue(), 6000);

    // Initial DTN flush on boot
    setTimeout(() => this.flushPendingQueue(), 1500);
  }

  public stop() {
    this.isStarted = false;
    if (this.purgeInterval) { clearInterval(this.purgeInterval); this.purgeInterval = null; }
    if (this.flushInterval) { clearInterval(this.flushInterval); this.flushInterval = null; }
    if (this.persistNoncesTimer) { clearTimeout(this.persistNoncesTimer); this.persistNoncesTimer = null; }
    if (this.unsubscribeNetwork) { this.unsubscribeNetwork(); this.unsubscribeNetwork = null; }
    for (const queries of this.pendingIdentityQueries.values()) {
      for (const q of queries) {
        if (q.timer) clearTimeout(q.timer);
      }
    }
    this.pendingIdentityQueries.clear();
    if (this.wifi) {
      this.wifi.disconnect();
    }
  }

  public destroy() {
    this.stop();
  }

  private handleNetworkChange(state: NetworkState) {
    const previousInternet = this.hasInternetAccess;
    this.hasInternetAccess = state.hasInternetAccess;

    console.log(`[MeshRouter] Network state updated: online=${state.connected}, type=${state.connectionType}, internet=${state.hasInternetAccess}`);

    if (state.connected) {
      // Proactively refresh signaling and trigger ICE restarts for 4G/5G transitions
      this.wifi?.reconnect(true).catch(() => {});

      // Flush persistent offline DTN queue upon network restoration
      this.flushPendingQueue().catch(() => {});

      // Announce updated gateway capability to local mesh peers
      if (previousInternet !== state.hasInternetAccess) {
        this.sendIdentityAnnounce().catch(() => {});
      }
    }
  }

  // ─── Canonical Identity Lookup & Handshake ───────────────────────────────────

  /**
   * Returns the 64-character canonical identity_hash associated with any
   * hardware ID (BLE MAC, UUID, WiFi peer ID) or returns the original ID
   * if already canonical.
   */
  getCanonicalId(id: string): string {
    if (!id) return '';
    const clean = normalizeIdentity(id);
    if (clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean)) {
      return clean;
    }
    const rawTrimmed = id.trim();

    if (this.deviceToCanonicalMap.has(clean)) {
      return this.deviceToCanonicalMap.get(clean)!;
    }
    if (this.deviceToCanonicalMap.has(rawTrimmed)) {
      return this.deviceToCanonicalMap.get(rawTrimmed)!;
    }

    const peer = this.peers.get(clean) || this.peers.get(rawTrimmed);
    if (peer?.canonicalId && peer.canonicalId.length === 64) {
      return peer.canonicalId.toLowerCase();
    }

    // Heuristic lookup: Check if any peer has this as raw ID or matching prefix
    for (const [k, p] of this.peers.entries()) {
      if (p.id?.toLowerCase() === clean || p.canonicalId?.toLowerCase() === clean) {
        if (p.canonicalId && p.canonicalId.length === 64) {
          return p.canonicalId.toLowerCase();
        }
      }
    }

    if (clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean)) {
      return clean;
    }

    // Resolve hyphenated conversation IDs (e.g. short1-short2)
    if (id.includes('-')) {
      const parts = id.split('-');
      for (const part of parts) {
        if (part.length >= 8) {
          const match = this.getCanonicalId(part);
          if (match && match.length === 64) return match;
          for (const [k, p] of this.peers.entries()) {
            if (k.startsWith(part) || p.canonicalId?.startsWith(part) || p.id?.startsWith(part)) {
              if (p.canonicalId && p.canonicalId.length === 64) return p.canonicalId.toLowerCase();
              if (k.length === 64) return k.toLowerCase();
            }
          }
        }
      }
    }

    // Resolve short prefixes against local contacts store
    if (typeof window !== 'undefined' && clean.length < 64) {
      try {
        const rawConts = localStorage.getItem('red_web_contacts');
        if (rawConts) {
          const conts = JSON.parse(rawConts);
          const found = conts.find((c: any) => {
            const cH = normalizeIdentity(c.identity_hash || '');
            return cH === clean || (clean.length >= 8 && cH.startsWith(clean.slice(0, 8))) || (clean.includes('-') && cH.startsWith(clean.split('-')[1]?.slice(0, 8) || '____'));
          });
          if (found?.identity_hash && found.identity_hash.length === 64) {
            return found.identity_hash.toLowerCase();
          }
        }
      } catch {}
    }

    return clean;
  }

  /**
   * Returns all active peer records.
   */
  getAllPeers(): MeshPeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Finds a peer record by hardware ID, canonical ID, or reverse lookup.
   */
  getPeerByAnyId(id: string): MeshPeer | undefined {
    if (!id) return undefined;
    const clean = normalizeIdentity(id);
    const raw = id.trim();
    if (this.peers.has(clean)) return this.peers.get(clean);
    if (this.peers.has(raw)) return this.peers.get(raw);
    const canonical = this.getCanonicalId(clean);
    if (canonical && this.peers.has(canonical)) return this.peers.get(canonical);
    for (const p of this.peers.values()) {
      if (
        p.id?.toLowerCase() === clean || 
        p.id?.toLowerCase() === raw.toLowerCase() || 
        p.canonicalId?.toLowerCase() === clean || 
        (canonical && p.canonicalId?.toLowerCase() === canonical.toLowerCase())
      ) {
        return p;
      }
    }
    return undefined;
  }

  /**
   * Subscribes to identity resolution events (Hardware ID -> Canonical DID).
   */
  onIdentityResolved(cb: (info: { hardwareId: string; canonicalId: string; displayName: string; publicKey?: string }) => void): () => void {
    this.identityResolvedListeners.add(cb);
    return () => this.identityResolvedListeners.delete(cb);
  }

  /**
   * Subscribes to Shake-to-Pair P2P handshake signals.
   */
  onShakePair(cb: (peer: { identity_hash: string; display_name: string; public_key?: string; timestamp: number }) => void): () => void {
    this.shakePairListeners.add(cb);
    return () => this.shakePairListeners.delete(cb);
  }

  /**
   * Broadcasts a real P2P Shake & Pair pulse across all active transports.
   */
  async broadcastShakePair(displayName?: string, publicKey?: string | null): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      let name = displayName;
      let pk = publicKey;
      if (!name && typeof window !== 'undefined') {
        name = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pk = localStorage.getItem('red_public_key') || this.myIdentityHash;
      }
      const payloadObj = {
        type: 'SHAKE_PAIR_BROADCAST',
        payload: {
          identity_hash: this.myIdentityHash,
          display_name: name || 'Operador RED',
          public_key: pk || null,
          timestamp: Date.now()
        }
      };
      const raw = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(
        this.myIdentityHash,
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        raw
      );
      await this.broadcast(encode(packet));
    } catch (e) {
      console.warn('[MeshRouter] Failed to broadcast shake pair:', e);
    }
  }

  /**
   * Sends a targeted Shake & Pair acceptance response.
   */
  async sendShakePairAccept(targetHash: string, displayName?: string, publicKey?: string | null): Promise<void> {
    try {
      if (!this.myIdentityHash || !targetHash) return;
      let name = displayName;
      let pk = publicKey;
      if (!name && typeof window !== 'undefined') {
        name = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pk = localStorage.getItem('red_public_key') || this.myIdentityHash;
      }
      const payloadObj = {
        type: 'SHAKE_PAIR_ACCEPT',
        payload: {
          identity_hash: this.myIdentityHash,
          display_name: name || 'Operador RED',
          public_key: pk || null,
          timestamp: Date.now()
        }
      };
      const raw = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(
        this.myIdentityHash,
        targetHash,
        raw
      );
      await this.broadcast(encode(packet));
    } catch (e) {
      console.warn('[MeshRouter] Failed to send shake pair accept:', e);
    }
  }

  /**
   * Binds a hardware device ID (e.g. BLE MAC) to a canonical 64-hex identity_hash.
   */
  bindDeviceToCanonical(deviceId: string, canonicalId: string, displayName?: string, publicKey?: string) {
    if (!deviceId || !canonicalId) return;
    const cleanDevice = normalizeIdentity(deviceId);
    const cleanCanonical = normalizeIdentity(canonicalId);

    this.deviceToCanonicalMap.set(cleanDevice, cleanCanonical);
    this.deviceToCanonicalMap.set(deviceId.trim(), cleanCanonical);

    if (typeof window !== 'undefined') {
      try {
        const entries = Array.from(this.deviceToCanonicalMap.entries()).slice(-500);
        localStorage.setItem('red_device_canonical_map', JSON.stringify(entries));
      } catch {}
    }

    // Migrate any temporary peer record under deviceId to canonicalId
    const tempPeer = this.peers.get(cleanDevice) || this.peers.get(deviceId.trim());
    if (tempPeer && cleanDevice !== cleanCanonical) {
      this.peers.delete(cleanDevice);
      this.peers.delete(deviceId.trim());
      this.updatePeer(
        cleanCanonical,
        (tempPeer.transport as any) || 'ble',
        tempPeer.rssi,
        cleanCanonical,
        displayName || tempPeer.name,
        publicKey || tempPeer.publicKey,
        tempPeer.isGateway,
        tempPeer.hasInternet
      );
    } else if (displayName || publicKey) {
      const existing = this.peers.get(cleanCanonical);
      if (existing) {
        if (displayName && !existing.name?.startsWith('Operador ')) existing.name = displayName;
        if (publicKey) existing.publicKey = publicKey;
        this.peers.set(cleanCanonical, existing);
      }
    }

    // Notify registered identity resolved subscribers (useRedStore, etc.)
    const resolvedName = displayName || tempPeer?.name || `Operador ${cleanCanonical.slice(0, 6)}`;
    const resolvedPk = publicKey || tempPeer?.publicKey;
    this.identityResolvedListeners.forEach(listener => {
      try {
        listener({
          hardwareId: cleanDevice,
          canonicalId: cleanCanonical,
          displayName: resolvedName,
          publicKey: resolvedPk
        });
      } catch (err) {
        console.error('[MeshRouter] Identity resolved listener error:', err);
      }
    });

    // Resolve any awaiting query promises
    this.notifyPendingIdentityQueries(cleanDevice, cleanCanonical, displayName, publicKey);
    this.notifyPendingIdentityQueries(cleanCanonical, cleanCanonical, displayName, publicKey);
  }

  private notifyPendingIdentityQueries(key: string, identityHash: string, displayName?: string, publicKey?: string) {
    const list = this.pendingIdentityQueries.get(key);
    if (list && list.length > 0) {
      this.pendingIdentityQueries.delete(key);
      for (const q of list) {
        clearTimeout(q.timer);
        q.resolve({
          identity_hash: identityHash,
          display_name: displayName || `Operador ${identityHash.slice(0, 6)}`,
          public_key: publicKey,
        });
      }
    }
  }

  /**
   * Queries the canonical identity of an active peer over the link if not yet resolved.
   */
  async queryIdentity(deviceId: string, transport?: 'ble' | 'wifi'): Promise<{ identity_hash: string; display_name: string; public_key?: string } | null> {
    const canonical = this.getCanonicalId(deviceId);
    if (canonical && canonical.length === 64 && canonical !== deviceId) {
      const peer = this.getPeerByAnyId(canonical);
      return {
        identity_hash: canonical,
        display_name: peer?.name || `Operador ${canonical.slice(0, 6)}`,
        public_key: peer?.publicKey,
      };
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const remaining = (this.pendingIdentityQueries.get(deviceId) || []).filter(q => q.timer !== timer);
        if (remaining.length > 0) this.pendingIdentityQueries.set(deviceId, remaining);
        else this.pendingIdentityQueries.delete(deviceId);
        resolve(null);
      }, 3000);

      const entry: PendingIdentityQuery = { resolve, reject: () => resolve(null), timer };
      const current = this.pendingIdentityQueries.get(deviceId) || [];
      current.push(entry);
      this.pendingIdentityQueries.set(deviceId, current);

      // Send IDENTITY_REQUEST packet over transport
      this.sendIdentityRequest(deviceId, transport).catch(() => {});
    });
  }

  /**
   * Broadcasts or sends an IDENTITY_ANNOUNCE packet with Gateway capability metrics.
   */
  async sendIdentityAnnounce(targetDeviceId?: string, transport?: 'ble' | 'wifi' | 'lora'): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      let displayName = 'Operador RED';
      let pubKey = '';
      let shortId = this.myIdentityHash.slice(0, 8);

      let bio = '';
      let phone = '';
      if (typeof window !== 'undefined') {
        displayName = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pubKey = localStorage.getItem('red_public_key') || this.myIdentityHash;
        shortId = localStorage.getItem('red_short_id') || this.myIdentityHash.slice(0, 8);
        bio = localStorage.getItem('red_bio') || localStorage.getItem('user_bio') || '';
        phone = localStorage.getItem('red_phoneNumber') || localStorage.getItem('user_phone_number') || '';
      }

      const payloadObj = {
        type: 'IDENTITY_ANNOUNCE',
        payload: {
          identity_hash: this.myIdentityHash,
          display_name: displayName,
          public_key: pubKey,
          short_id: shortId,
          bio: bio,
          phone_number: phone,
          timestamp: Date.now(),
          capabilities: {
            is_gateway: this.hasInternetAccess,
            has_internet: this.hasInternetAccess,
            gateway_metric: this.hasInternetAccess ? 100 : 0,
            version: RED_VERSION
          }
        }
      };

      const rawPayload = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(
        this.myIdentityHash,
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        rawPayload
      );
      const encoded = encode(packet);

      if (targetDeviceId && transport) {
        await this.sendToPeer(targetDeviceId, transport, encoded);
      } else {
        await this.broadcast(encoded);
      }
    } catch (e) {
      console.warn('[MeshRouter] Failed to send identity announce:', e);
    }
  }

  /**
   * Sends an IDENTITY_RESPONSE packet directly to a peer that announced or requested identity.
   */
  async sendIdentityResponse(recipientHash: string, targetDeviceId?: string, transport?: 'ble' | 'wifi' | 'lora'): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      let displayName = 'Operador RED';
      let pubKey = '';
      let shortId = this.myIdentityHash.slice(0, 8);

      if (typeof window !== 'undefined') {
        displayName = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pubKey = localStorage.getItem('red_public_key') || this.myIdentityHash;
        shortId = localStorage.getItem('red_short_id') || this.myIdentityHash.slice(0, 8);
      }

      const payloadObj = {
        type: 'IDENTITY_RESPONSE',
        payload: {
          identity_hash: this.myIdentityHash,
          display_name: displayName,
          public_key: pubKey,
          short_id: shortId,
          timestamp: Date.now(),
          capabilities: {
            is_gateway: this.hasInternetAccess,
            has_internet: this.hasInternetAccess,
            gateway_metric: this.hasInternetAccess ? 100 : 0,
            version: '31.1.0'
          }
        }
      };

      const rawPayload = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(this.myIdentityHash, recipientHash, rawPayload);
      const encoded = encode(packet);

      if (targetDeviceId && transport) {
        await this.sendToPeer(targetDeviceId, transport, encoded);
      } else {
        await this.forwardPacket(packet, null);
      }
    } catch (e) {
      console.warn('[MeshRouter] Failed to send identity response:', e);
    }
  }

  /**
   * Sends an IDENTITY_REQUEST query packet to a peer.
   */
  private async sendIdentityRequest(targetDeviceId?: string, transport?: 'ble' | 'wifi' | 'lora'): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      const payloadObj = {
        type: 'IDENTITY_REQUEST',
        payload: {
          requester_hash: this.myIdentityHash,
          timestamp: Date.now(),
        }
      };
      const rawPayload = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(
        this.myIdentityHash,
        targetDeviceId && targetDeviceId.length === 64 ? targetDeviceId : 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        rawPayload
      );
      const encoded = encode(packet);

      if (targetDeviceId && transport) {
        await this.sendToPeer(targetDeviceId, transport, encoded);
      } else {
        await this.broadcast(encoded);
      }
    } catch (e) {
      console.warn('[MeshRouter] Failed to send identity request:', e);
    }
  }

  // ─── Cryptographic Delivery Acknowledgments (DELIVERY_ACK) ──────────────────

  /**
   * Emits a signed DELIVERY_ACK confirming reception of a message packet.
   */
  public async sendDeliveryAck(recipientSenderHash: string, originalNonce: string, messageId?: string): Promise<void> {
    try {
      if (!this.myIdentityHash || !recipientSenderHash || recipientSenderHash === this.myIdentityHash) return;

      const payloadObj = {
        type: 'DELIVERY_ACK',
        payload: {
          nonce: originalNonce,
          message_id: messageId,
          recipient: this.myIdentityHash,
          timestamp: Date.now(),
        }
      };

      const rawPayload = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(this.myIdentityHash, recipientSenderHash, rawPayload);
      console.log(`[MeshRouter] Emitting DELIVERY_ACK for packet ${originalNonce.slice(0, 8)} to ${recipientSenderHash.slice(0, 8)}`);
      await this.forwardPacket(packet, null);
    } catch (e) {
      console.warn('[MeshRouter] Failed to emit DELIVERY_ACK:', e);
    }
  }

  // ─── Sending ────────────────────────────────────────────────────────────────

  /**
   * Send a payload to a specific recipient identity hash.
   * Tracks delivery in the persistent DTN queue until end-to-end DELIVERY_ACK is confirmed.
   */
  async send(recipientHash: string, payload: Uint8Array): Promise<'sent' | 'queued' | 'failed'> {
    const canonicalRecipient = this.getCanonicalId(recipientHash);
    const packet = createPacket(this.myIdentityHash, canonicalRecipient, payload);

    const isBroadcast =
      canonicalRecipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
      canonicalRecipient === '0000000000000000000000000000000000000000000000000000000000000000';

    let isProtocol = false;
    try {
      const str = new TextDecoder().decode(payload);
      if (str.includes('DELIVERY_ACK') || str.includes('IDENTITY_ANNOUNCE') || str.includes('IDENTITY_RESPONSE')) {
        isProtocol = true;
      }
    } catch {}

    // Store-and-Forward: register in persistent DTN tracker to guarantee delivery
    if (!isBroadcast && !isProtocol) {
      dtnStorage.enqueue(packet);
    }

    return this.forwardPacket(packet, null);
  }

  /**
   * Broadcast a raw payload to ALL connected peers (mesh flood) and WAN relays.
   */
  async broadcast(payload: Uint8Array, exceptPeer?: string): Promise<number> {
    let sent = 0;
    for (const [peerId, peer] of this.peers) {
      if (peerId === exceptPeer) continue;
      const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora') || 'ble', payload);
      if (ok) sent++;
    }

    // Also forward to WAN / WebRTC / MQTT Blind Relay
    try {
      const packet = decode(payload);
      if (packet) {
        if (packet.recipient && packet.recipient !== 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' && packet.recipient.length >= 16) {
          this.wifi?.send(packet.recipient, payload).catch(() => {});
        } else {
          this.wifi?.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payload).catch(() => {});
        }
      }
    } catch {}

    return sent;
  }

  // ─── Receiving & Relaying ───────────────────────────────────────────────────

  private async handleRawPacket(raw: Uint8Array, fromTransportId?: string, transportType?: 'ble' | 'wifi' | 'lora') {
    let packet = decode(raw);
    if (!packet) {
      // Check if raw is a JSON envelope string (e.g. from MQTT relay, Hive capacity ads, or direct Web bridge)
      try {
        let cleanRaw = raw;
        if (raw.length >= 5 && raw[0] === 0 && raw[1] === 0 && raw[4] === 123 /* '{' */) {
          cleanRaw = raw.slice(4);
        }
        const str = new TextDecoder().decode(cleanRaw);
        if (str.startsWith('{')) {
          const parsed = JSON.parse(str);
          if (parsed.type || parsed.sender || parsed.content || parsed.recipient || parsed.msg_type) {
            packet = {
              recipient: this.getCanonicalId(parsed.recipient || this.myIdentityHash),
              sender: this.getCanonicalId(parsed.sender || fromTransportId || 'unknown'),
              ttl: 10,
              flags: 0,
              timestamp: (parsed.timestamp ? (parsed.timestamp > 1e11 ? parsed.timestamp : parsed.timestamp * 1000) : Date.now()),
              nonce: parsed.id || ('nonce_' + Math.random().toString(36).substring(2, 10)),
              payload: cleanRaw,
            };
          }
        }
      } catch {}
    }

    if (!packet) {
      console.warn('[MeshRouter] Received malformed packet, ignoring');
      return;
    }

    // Dedup check
    if (this.isDuplicate(packet.nonce)) {
      slottedGossip.recordHeardFromPeer(packet.nonce);
      return; // Already seen this packet — drop silently
    }
    this.markSeen(packet.nonce);
    slottedGossip.recordHeardFromPeer(packet.nonce);

    // Bind packet sender to transport ID if provided
    if (packet.sender && packet.sender.length === 64) {
      if (fromTransportId) {
        this.bindDeviceToCanonical(fromTransportId, packet.sender);
      }
      this.updatePeer(packet.sender, transportType || 'ble', undefined, packet.sender);
    }

    let isHandshakeMsg = false;
    let isLocationMsg = false;
    let isDeliveryAck = false;
    let ackNonce: string | null = null;
    let ackMessageId: string | null = null;
    let incomingMsgId: string | null = null;
    let payloadStr = '';

    try {
      payloadStr = new TextDecoder().decode(packet.payload);

      // 1. DELIVERY_ACK Handling
      if (payloadStr.startsWith('{') && payloadStr.includes('DELIVERY_ACK')) {
        const parsed = JSON.parse(payloadStr);
        if (parsed.type === 'DELIVERY_ACK' && parsed.payload) {
          isDeliveryAck = true;
          ackNonce = parsed.payload.nonce;
          ackMessageId = parsed.payload.message_id;

          if (ackNonce) {
            dtnStorage.remove(ackNonce);
            console.log(`[MeshRouter] ✅ Received DELIVERY_ACK for nonce ${ackNonce.slice(0, 8)} — cleared from DTN storage`);
          }

          // Update local conversation store message status to 'Delivered'
          if (typeof window !== 'undefined' && (ackMessageId || ackNonce)) {
            try {
              const peerKey = this.getCanonicalId(packet.sender);
              const shortPeerKey = peerKey.slice(0, 8);
              const keysToCheck = [
                `red_web_messages_${peerKey}`,
                `red_web_messages_${shortPeerKey}`,
                `red_web_messages_${packet.sender}`
              ];

              for (const convKey of keysToCheck) {
                const rawMsgs = localStorage.getItem(convKey);
                if (rawMsgs) {
                  const msgs = JSON.parse(rawMsgs);
                  let updated = false;
                  for (const m of msgs) {
                    const matchesAck = (ackMessageId && m.id === ackMessageId) || (ackNonce && (m.id === ackNonce || m.nonce === ackNonce));
                    if (matchesAck) {
                      m.status = 'Delivered';
                      m.delivered = true;
                      updated = true;
                    }
                  }
                  if (updated) {
                    localStorage.setItem(convKey, JSON.stringify(msgs));
                  }
                }
              }

              // Reactively update active messages in Zustand store without delay
              import('../../store/useRedStore').then(({ useRedStore }) => {
                const currentMsgs = useRedStore.getState().messages;
                let storeUpdated = false;
                const updatedStoreMsgs = currentMsgs.map(m => {
                  const matchesAck = (ackMessageId && m.id === ackMessageId) || (ackNonce && (m.id === ackNonce || m.nonce === ackNonce));
                  if (matchesAck) {
                    storeUpdated = true;
                    return { ...m, status: 'Delivered' as const, delivered: true };
                  }
                  return m;
                });
                if (storeUpdated) {
                  useRedStore.setState({ messages: updatedStoreMsgs });
                }
              }).catch(() => {});
            } catch {}
          }
          return;
        }
      }

      // Check if this payload has an internal message ID
      if (payloadStr.startsWith('{')) {
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed.id) incomingMsgId = parsed.id;
        } catch {}
      }

      // 2. Identity Handshake Protocol Handling
      if (payloadStr.startsWith('{') && (payloadStr.includes('IDENTITY_ANNOUNCE') || payloadStr.includes('IDENTITY_RESPONSE') || payloadStr.includes('IDENTITY_REQUEST'))) {
        const parsed = JSON.parse(payloadStr);

        if (parsed.type === 'IDENTITY_ANNOUNCE' || parsed.type === 'IDENTITY_RESPONSE') {
          const idData = parsed.payload;
          if (idData?.identity_hash) {
            const peerHash = idData.identity_hash;
            const peerName = idData.display_name || `Operador ${peerHash.slice(0, 6)}`;
            const peerPk = idData.public_key;
            const isGateway = !!(idData.capabilities?.is_gateway || idData.is_gateway);
            const hasInternet = !!(idData.capabilities?.has_internet || idData.has_internet);

            if (fromTransportId) {
              this.bindDeviceToCanonical(fromTransportId, peerHash, peerName, peerPk);
            }
            this.bindDeviceToCanonical(packet.sender, peerHash, peerName, peerPk);
            this.updatePeer(peerHash, transportType || 'ble', undefined, peerHash, peerName, peerPk, isGateway, hasInternet);

            // Mesh contact isolation: ONLY update metadata if the peer already exists in contacts.
            // If the peer is unknown, they are registered exclusively in meshRouter.peers (Radar/topology).
            // Adding a contact is an EXPLICIT user action (QR, DID, "Add Contact" button) — never automatic.
            if (typeof window !== 'undefined' && peerName && !peerName.startsWith('RED-') && !peerName.startsWith('Operador ')) {
              try {
                const cachedConts = JSON.parse(localStorage.getItem('red_web_contacts') || '[]') as any[];
                const cIdx = cachedConts.findIndex((c: any) =>
                  c.identity_hash?.toLowerCase() === peerHash.toLowerCase() ||
                  (peerHash.length >= 8 && c.identity_hash?.toLowerCase().startsWith(peerHash.slice(0, 8).toLowerCase()))
                );
                if (cIdx >= 0) {
                  // Peer is an existing contact — refresh their identity metadata only
                  cachedConts[cIdx] = {
                    ...cachedConts[cIdx],
                    display_name: peerName,
                    bio: idData.bio || cachedConts[cIdx].bio,
                    phone_number: idData.phone_number || cachedConts[cIdx].phone_number,
                    public_key: peerPk || cachedConts[cIdx].public_key
                  };
                  localStorage.setItem('red_web_contacts', JSON.stringify(cachedConts));
                }
                // cIdx === -1: unknown peer — stays in meshRouter.peers only. Do NOT push to contacts.
              } catch {}
            }

            // Auto-respond to new announcements so neighbor binds us symmetrically
            if (parsed.type === 'IDENTITY_ANNOUNCE' && peerHash !== this.myIdentityHash) {
              this.sendIdentityResponse(peerHash, fromTransportId, transportType).catch(() => {});
            }
          }
          return;
        }

        if (parsed.type === 'IDENTITY_REQUEST') {
          const reqSender = parsed.payload?.requester_hash || packet.sender;
          if (reqSender && reqSender !== this.myIdentityHash) {
            this.sendIdentityResponse(reqSender, fromTransportId, transportType).catch(() => {});
          }
          return;
        }
      }

      // 3. Shake-to-Pair Real P2P Mesh Handshake
      if (payloadStr.startsWith('{') && (payloadStr.includes('SHAKE_PAIR_BROADCAST') || payloadStr.includes('SHAKE_PAIR_ACCEPT'))) {
        try {
          const parsed = JSON.parse(payloadStr);
          const peerPayload = parsed.payload;
          if (peerPayload && peerPayload.identity_hash && peerPayload.identity_hash !== this.myIdentityHash) {
            const pHash = peerPayload.identity_hash;
            const pName = peerPayload.display_name || `Nodo ${pHash.slice(0, 8)}`;
            const pPk = peerPayload.public_key;
            if (fromTransportId) {
              this.bindDeviceToCanonical(fromTransportId, pHash, pName, pPk);
            }
            this.bindDeviceToCanonical(packet.sender, pHash, pName, pPk);
            
            this.shakePairListeners.forEach(listener => {
              try { listener(peerPayload); } catch (e) { console.error('[MeshRouter] Shake listener error:', e); }
            });

            if (parsed.type === 'SHAKE_PAIR_BROADCAST') {
              this.sendShakePairAccept(pHash).catch(() => {});
            }
            return;
          }
        } catch {}
      }

      // 4. Contact & Location Signals
      isHandshakeMsg = payloadStr.includes('contact_request') || payloadStr.includes('contact_response') || payloadStr.includes('shake_pair_');
      if (payloadStr.startsWith('{"type":"NODE_LOCATION_UPDATE"')) {
        isLocationMsg = true;
        const data = JSON.parse(payloadStr);
        if (data.payload && typeof data.payload.lat === 'number' && typeof data.payload.lng === 'number') {
          const peerId = data.payload.nodeId || packet.sender;
          const canonical = this.getCanonicalId(peerId);
          const peer = this.peers.get(canonical) || this.peers.get(peerId);
          if (peer) {
            peer.lat = data.payload.lat;
            peer.lng = data.payload.lng;
          }
        }
      }
    } catch {}

    let myHash = this.myIdentityHash;
    if (!myHash && typeof window !== 'undefined') {
      try {
        myHash = localStorage.getItem('red_identity_hash') || '';
        if (myHash) this.myIdentityHash = myHash;
      } catch {}
    }

    const isBroadcast =
      packet.recipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
      packet.recipient === '0000000000000000000000000000000000000000000000000000000000000000';

    const isDirectlyToMe =
      (!!myHash && packet.recipient === myHash) ||
      (!!myHash && packet.recipient.length >= 8 && myHash.toLowerCase().startsWith(packet.recipient.toLowerCase())) ||
      (!!myHash && packet.recipient.length >= 8 && packet.recipient.toLowerCase().startsWith(myHash.toLowerCase()));

    const isForMe = isBroadcast || isDirectlyToMe || (isLocationMsg && isBroadcast) || isHandshakeMsg;

    if (isForMe) {
      // ── FINAL DELIVERY: packet is for us ──
      console.log(`[MeshRouter] Packet delivered locally from ${packet.sender.slice(0, 8)} (type: ${isHandshakeMsg ? 'handshake' : 'msg'})`);
      
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
      const isJsonPayload = payloadStr.trim().startsWith('{') || payloadStr.trim().startsWith('[');

      if (isJsonPayload || !isNative) {
        // Structured JSON packet (Web <-> Mobile bridge, direct P2P chat, handshakes):
        // Deliver directly to local store handlers with idempotency deduplication
        this.localDeliveryHandlers.forEach(h => {
          try { h(packet); } catch (err) { console.error('[MeshRouter] Handler error:', err); }
        });
      } else {
        // Binary OnionPacket from Rust P2P swarm: inject to Rust node
        this.deliverToRustNode(packet).catch(() => {
          this.localDeliveryHandlers.forEach(h => {
            try { h(packet); } catch (err) { console.error('[MeshRouter] Handler fallback error:', err); }
          });
        });
      }

      // Emit DELIVERY_ACK to sender (unless broadcast packet or handshake)
      if (packet.sender && packet.sender !== this.myIdentityHash && !isBroadcast && !isHandshakeMsg && !isDeliveryAck) {
        this.sendDeliveryAck(packet.sender, packet.nonce, incomingMsgId || undefined).catch(() => {});
      }
    } else {
      // ── RELAY: packet is for someone else — forward it ──
      // If we are a Gateway with internet and the packet is addressed to a remote DID, uplink it!
      const forwarded = relay(packet);
      if (forwarded) {
        const encoded = encode(forwarded);

        // Slotted Backoff Gossip anti-storm suppression in dense RF topologies
        const shouldRelay = await slottedGossip.shouldRelayPacket(packet.nonce, encoded.length, this.peers.size);
        if (!shouldRelay) {
          console.log(`[MeshRouter] SlottedGossip suppressed redundant relay for packet ${packet.nonce.slice(0, 8)}`);
          return;
        }

        console.log(`[MeshRouter] Relaying packet → ${packet.recipient.slice(0, 8)} (TTL ${forwarded.ttl})`);

        // Broadcast to local mesh peers
        await this.broadcast(encoded, fromTransportId);

        // If we have internet, also bridge/uplink the packet over WAN WebRTC/Relay to the remote world
        if (this.hasInternetAccess && this.wifi) {
          this.wifi.send(packet.recipient, encoded).catch(() => {});
        }
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
    const isBroadcast =
      packet.recipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
      packet.recipient === '0000000000000000000000000000000000000000000000000000000000000000';

    let anySent = false;

    // ─── 1. SMART UNICAST DIRECT ROUTING (Fast Path) ───
    if (!isBroadcast) {
      const canonicalRecipient = this.getCanonicalId(packet.recipient);
      const directPeer = this.getPeerByAnyId(canonicalRecipient);

      if (directPeer) {
        // Direct Fast-Path 1: Direct WebRTC DataChannel (54 Mbps, <30ms)
        if (this.wifi && (directPeer.transport === 'wifi' || this.wifi.onlinePeers.has(canonicalRecipient) || this.wifi.onlinePeers.has(directPeer.id))) {
          const targetId = this.wifi.onlinePeers.has(canonicalRecipient) ? canonicalRecipient : directPeer.id;
          const ok = await this.wifi.send(targetId, encoded);
          if (ok) {
            console.log(`[MeshRouter] ⚡ Fast-path: Delivered directly to ${canonicalRecipient.slice(0, 8)} via WiFi Direct`);
            dtnStorage.markAttempt(packet.nonce, false);
            return 'sent';
          }
        }

        // Direct Fast-Path 2: Direct BLE GATT (<100ms) with LQS verification
        const lqs = directPeer.rssi ? bluetoothTransport.getLinkQuality(directPeer.id) : 70;
        if (lqs >= 20) {
          const bleTargetId = directPeer.id || canonicalRecipient;
          const ok = await bluetoothTransport.send(bleTargetId, encoded);
          if (ok) {
            console.log(`[MeshRouter] 📶 Direct BLE send to ${canonicalRecipient.slice(0, 8)} (LQS ${lqs}%)`);
            dtnStorage.markAttempt(packet.nonce, false);
            return 'sent';
          }
        }
      }
    }

    // ─── 2. CONTROLLED MULTI-HOP FLOOD (LQS-Filtered) ───
    // If not a direct peer or direct send failed, forward to connected neighbors with healthy links
    const peersToSend = Array.from(this.peers.entries())
      .filter(([id, peer]) => {
        if (id === exceptPeer) return false;
        // Don't waste radio energy on severely degraded links (LQS < 15%)
        const lqs = peer.rssi ? bluetoothTransport.getLinkQuality(id) : 70;
        return lqs >= 15;
      });

    for (const [peerId, peer] of peersToSend) {
      const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora') || 'ble', encoded);
      if (ok) anySent = true;
    }

    // ─── 3. GLOBAL WAN / WebRTC / MQTT Blind Relay Transport ───
    // For unicast packets, also attempt WAN relay uplink
    if (this.wifi && !isBroadcast) {
      const ok = await this.wifi.send(packet.recipient, encoded);
      if (ok) anySent = true;
    }

    // ─── 4. AUTONOMOUS MESH-TO-INTERNET GATEWAY DELEGATION ───
    // If we have NO internet, but a nearby local BLE/WiFi peer is an active Gateway:
    if (!anySent && !this.hasInternetAccess && this.activeGateways.size > 0) {
      for (const [gwId, gwPeer] of this.activeGateways.entries()) {
        if (gwId === exceptPeer) continue;
        console.log(`[MeshRouter] Delegating uplink packet to local Gateway ${gwId.slice(0, 8)} via ${gwPeer.transport || 'ble'}`);
        const ok = await this.sendToPeer(gwId, (gwPeer.transport as 'wifi' | 'ble' | 'lora') || 'ble', encoded);
        if (ok) {
          anySent = true;
          break;
        }
      }
    }

    if (!anySent) {
      // Enqueue in persistent DTN store-and-forward storage
      dtnStorage.enqueue(packet);
      console.log(`[MeshRouter] No reachable route — saved in persistent DTN queue for ${packet.recipient.slice(0, 8)}`);
      return 'queued';
    } else {
      // Record attempt for unacknowledged retransmission
      dtnStorage.markAttempt(packet.nonce, false);
    }

    return 'sent';
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
      if (transport === 'lora') {
        return await this.sendViaLoRa(payload);
      }
    } catch (e) {
      console.warn(`[MeshRouter] Send to ${peerId} via ${transport} failed:`, e);
    }
    return false;
  }

  private async sendViaLoRa(payload: Uint8Array): Promise<boolean> {
    try {
      const okHardware = await loraBridge.sendPacket(payload);
      const hex = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join('');
      await RedAPI.injectMeshPayload(hex, true).catch(() => {});
      return okHardware;
    } catch {
      return false;
    }
  }

  // ─── Rust Node Integration ───────────────────────────────────────────────────

  private async deliverToRustNode(packet: MeshPacket) {
    const hex = Array.from(packet.payload)
      .map(b => b.toString(16).padStart(2, '0')).join('');
    try {
      await RedAPI.injectMeshPayload(hex);
    } catch (e) {
      console.error('[MeshRouter] Failed to deliver to Rust node:', e);
      throw e;
    }
  }

  // ─── DTN Store-and-Forward Queue Flusher ──────────────────────────────────────

  public async flushPendingQueue() {
    const items = dtnStorage.getItemsToRetry();
    if (items.length === 0) return;

    let flushed = 0;
    for (const item of items) {
      const packet = dtnStorage.toMeshPacket(item);
      const encoded = encode(packet);
      let sent = false;

      // 1. Direct local mesh peers
      for (const [peerId, peer] of this.peers) {
        const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora') || 'ble', encoded);
        if (ok) sent = true;
      }

      // 2. Global WAN / WebRTC / MQTT Blind Relay
      if (this.wifi && packet.recipient && packet.recipient !== 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') {
        const ok = await this.wifi.send(packet.recipient, encoded);
        if (ok) sent = true;
      }

      // 3. Mark attempt with exponential backoff (persists until cryptographic DELIVERY_ACK is received)
      dtnStorage.markAttempt(item.id, false);
      if (sent) flushed++;
    }

    if (flushed > 0) {
      console.log(`[MeshRouter] 🔄 Retransmitted ${flushed} DTN packets awaiting DELIVERY_ACK`);
    }

    // Periodically purge dead expired packets (>7 days)
    dtnStorage.purgeExpired();
  }

  // ─── Peer Management ─────────────────────────────────────────────────────────

  addWifiPeer(peerId: string, canonicalId?: string, name?: string, isGateway = false, hasInternet = false) {
    this.updatePeer(peerId, 'wifi', undefined, canonicalId, name, undefined, isGateway, hasInternet);
    this.flushPendingQueue();
  }

  addBlePeer(deviceId: string, rssi?: number, canonicalId?: string, name?: string, isGateway = false, hasInternet = false) {
    this.updatePeer(deviceId, 'ble', rssi, canonicalId, name, undefined, isGateway, hasInternet);
    this.flushPendingQueue();
  }

  addLoraPeer(peerId: string, canonicalId?: string, name?: string) {
    this.updatePeer(peerId, 'lora', undefined, canonicalId, name);
    this.flushPendingQueue();
  }

  removePeer(peerId: string) {
    this.peers.delete(peerId);
    this.activeGateways.delete(peerId);
    const canonical = this.deviceToCanonicalMap.get(peerId);
    if (canonical) {
      this.peers.delete(canonical);
      this.activeGateways.delete(canonical);
    }
  }

  public updatePeer(
    id: string,
    transport: 'wifi' | 'ble' | 'lora',
    rssi?: number,
    canonicalId?: string,
    name?: string,
    publicKey?: string,
    isGateway?: boolean,
    hasInternet?: boolean
  ) {
    if (!id) return;
    const cleanId = normalizeIdentity(id);
    let resolvedCanonical = canonicalId ? normalizeIdentity(canonicalId) : this.deviceToCanonicalMap.get(cleanId);

    // Cryptographic & explicit ID resolution only: do not guess/merge disparate devices based on name strings
    if (!resolvedCanonical) {
      resolvedCanonical = cleanId;
    }

    const existing = this.peers.get(resolvedCanonical) || this.peers.get(cleanId) || this.peers.get(id);

    const existingTransports = new Set<string>(existing?.transports || (existing?.transport ? [existing.transport] : []));
    existingTransports.add(transport);

    // Upgrade transport if better one found
    const priority: Record<string, number> = { wifi: 3, ble: 2, lora: 1 };
    const newPriority = priority[transport] || 0;
    const existingPriority = (existing && existing.transport) ? (priority[existing.transport] || 0) : 0;

    const finalIsGateway = isGateway !== undefined ? isGateway : (existing?.isGateway ?? false);
    const finalHasInternet = hasInternet !== undefined ? hasInternet : (existing?.hasInternet ?? false);

    // Pick best non-generic name (Contacts & Existing Registry are Single Source of Truth)
    let bestName = name || existing?.name;
    if (existing?.name && (!name || name === 'Dispositivo RED' || name.startsWith('Nodo ') || name.startsWith('Operador ') || name.startsWith('Par Escaneado'))) {
      bestName = existing.name;
    }
    if ((!bestName || bestName.startsWith('Nodo ') || bestName.startsWith('Operador ')) && typeof window !== 'undefined') {
      try {
        const rawConts = localStorage.getItem('red_web_contacts');
        if (rawConts) {
          const conts = JSON.parse(rawConts);
          const found = conts.find((c: any) => {
            const cH = normalizeIdentity(c.identity_hash || '');
            return cH === resolvedCanonical || cH === cleanId || (resolvedCanonical.length >= 8 && cH.startsWith(resolvedCanonical.slice(0, 8)));
          });
          if (found?.display_name && !found.display_name.startsWith('Operador ') && !found.display_name.startsWith('Nodo ') && !found.display_name.startsWith('Par Escaneado')) {
            bestName = found.display_name;
          }
        }
      } catch {}
    }

    const updated: MeshPeer = {
      id: resolvedCanonical,
      canonicalId: resolvedCanonical,
      name: bestName,
      publicKey: publicKey || existing?.publicKey,
      transport: newPriority >= existingPriority ? transport : (existing?.transport ?? transport),
      transports: Array.from(existingTransports) as any,
      lastSeen: Date.now(),
      rssi: rssi != null ? rssi : existing?.rssi,
      lat: existing?.lat,
      lng: existing?.lng,
      isGateway: finalIsGateway,
      hasInternet: finalHasInternet,
      gatewayMetric: finalHasInternet ? 100 : 0,
    };

    // Clean up duplicate keys in this.peers
    if (cleanId !== resolvedCanonical && this.peers.has(cleanId)) {
      this.peers.delete(cleanId);
    }
    if (id !== resolvedCanonical && this.peers.has(id)) {
      this.peers.delete(id);
    }
    this.peers.set(resolvedCanonical, updated);

    // Track active gateways
    if (finalIsGateway || finalHasInternet) {
      this.activeGateways.set(resolvedCanonical, updated);
    } else {
      this.activeGateways.delete(resolvedCanonical);
    }
  }

  getPeerList(): MeshPeer[] {
    return Array.from(this.peers.values())
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  async broadcastDiscovery(): Promise<void> {
    try {
      const { broadcastShakePair } = await import('../api');
      await broadcastShakePair();
    } catch {}
  }

  async broadcastLocation(lat: number, lng: number, altitude?: number, accuracy?: number): Promise<void> {
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'NODE_LOCATION_UPDATE',
        payload: {
          nodeId: this.myIdentityHash,
          lat,
          lng,
          altitude,
          accuracy,
          timestamp: Date.now()
        }
      }));
      await this.broadcast(payload);
    } catch {}
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

  get gatewayCount(): number {
    return this.activeGateways.size;
  }

  get pendingDtnCount(): number {
    return dtnStorage.count;
  }

  // ─── Deduplication ────────────────────────────────────────────────────────────

  private persistNoncesTimer: any = null;

  private isDuplicate(nonce: string): boolean {
    if (!this.seenNonces.has(nonce)) return false;
    // W6: Re-check if the entry has expired under its own adaptive window
    const ts = this.seenNonces.get(nonce)!;
    const window = dedupWindowFor(nonce);
    if (Date.now() - ts > window) {
      this.seenNonces.delete(nonce);
      return false;
    }
    return true;
  }

  private markSeen(nonce: string) {
    this.seenNonces.set(nonce, Date.now());
    if (this.seenNonces.size > MAX_DEDUP_CACHE) {
      // Evict oldest 1000 entries (insertion-order is O(1) in V8 Map)
      let count = 0;
      for (const k of this.seenNonces.keys()) {
        this.seenNonces.delete(k);
        count++;
        if (count >= 1000) break;
      }
    }
    this.schedulePersistSeenNonces();
  }

  private schedulePersistSeenNonces() {
    if (typeof window === 'undefined') return;
    if (this.persistNoncesTimer) return;
    this.persistNoncesTimer = setTimeout(() => {
      this.persistNoncesTimer = null;
      try {
        // W6: Only persist nonces within their adaptive window (skip expired short-window entries)
        const now = Date.now();
        const recent = Array.from(this.seenNonces.entries())
          .filter(([k, ts]) => (now - ts) < dedupWindowFor(k))
          .slice(-1000);
        localStorage.setItem('red_seen_nonces', JSON.stringify(recent));
      } catch {}
    }, 5000);
  }

  private purgeDedup() {
    const now = Date.now();
    for (const [nonce, ts] of this.seenNonces) {
      // W6: Each nonce expires against its own adaptive window
      if (now - ts > dedupWindowFor(nonce)) {
        this.seenNonces.delete(nonce);
      }
    }
    this.schedulePersistSeenNonces();
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────────

  onLocalDelivery(handler: MeshMessageHandler): () => void {
    this.localDeliveryHandlers.add(handler);
    return () => this.localDeliveryHandlers.delete(handler);
  }
}

/** Singleton mesh router instance */
export const meshRouter = new MeshRouter();

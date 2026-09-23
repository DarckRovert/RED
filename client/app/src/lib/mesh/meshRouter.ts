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
import { blindRelay } from './blindRelayTransport';
import { mqttRelay } from './mqttRelayTransport';
import { networkWatcher, NetworkState } from './networkWatcher';
import { RED_VERSION } from '../version';
import { dtnStorage } from './dtnStorage';
import { loraBridge } from '../hardware/LoraSerialBridgeEngine';
import { loraMeshtastic, MeshtasticPortNum, LoRaPacket } from './LoRaMeshtasticBridge';
import {
  MeshPacket,
  createPacket,
  decode,
  encode,
  relay,
  PQC_TYPE_KEY_ANNOUNCE,
  FLAG_KURAMOTO_SYNC,
  FLAG_AER_SPIKE,
  AER_MAGIC,
  AerDomainCode,
  AerSpikeEvent,
  encodeAerSpikeFrame,
  decodeAerSpikeFrame,
} from './meshProtocol';

import { RedAPI } from '../api';
import { slottedGossip } from './SlottedGossipEngine';
import { DnsTunnelEngine } from '../network/dnsTunnelEngine';
import { cognitiveArbiter } from './CognitiveRadioArbiter';
import { SoundMeshEngine, SoundMeshPacket } from '../audio/SoundMeshEngine';
import { globalShield } from '../network/GlobalShieldEngine';
import { multipathBonding, MultipathBondingEngine } from './MultipathBondingEngine';
import { loraTdmaScheduler } from './LoRaTdmaSchedulerEngine';
import { LamportMeshClockEngine } from './LamportMeshClockEngine';
import { broadcastStormGuardEngine } from './BroadcastStormGuardEngine';
import { tacticalMicroBurst } from './TacticalMicroBurstEngine';
import { synapticMeshRouter } from '../neuro/SynapticMeshRouterEngine';
import { giantFiberReflex } from '../neuro/GiantFiberReflexEngine';
import { dtnMushroomBody, SwarmPheromoneType } from '../neuro/DtnMushroomBodyEngine';
import { ringAttractor } from '../neuro/RingAttractorEngine';
import { HippocampalEpisodicEngine } from '../neuro/human/HippocampalEpisodicEngine';
import { TheoryOfMindEpistemicEngine } from '../neuro/human/TheoryOfMindEpistemicEngine';
import { PredictiveCortexEngine } from '../neuro/human/PredictiveCortexEngine';
import { TacticalLocationEngine } from '../sensors/TacticalLocationEngine';
import { swarmCriticality } from '../neuro/SwarmCriticalityEngine';

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

export type MeshTransport = 'wifi' | 'ble' | 'lora' | 'soundmesh';

export interface MeshPeer {
  id: string;          // Canonical node ID or hardware device ID
  canonicalId?: string; // Resolved canonical identity hash (64-char hex)
  hardwareId?: string;  // Original physical hardware address (e.g. BLE MAC "6B:2D:06:EA:DA:2E")
  name?: string;
  publicKey?: string;
  kyberPublicKey?: string; // NIST FIPS 203 ML-KEM-768 public key (hex)
  x25519PublicKey?: string; // Curve25519 Diffie-Hellman public key (hex)
  transport?: MeshTransport | string;
  transports?: MeshTransport[];
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
  private pruneInterval: any = null;
  private isStarted = false;

  /** Pending identity query promises keyed by hardware device ID or sender hash */
  private pendingIdentityQueries: Map<string, PendingIdentityQuery[]> = new Map();

  /** Listeners for packets addressed to THIS node (Set prevents duplicate subscriber registrations) */
  private localDeliveryHandlers: Set<MeshMessageHandler> = new Set();

  /** Listeners notified when a hardware device ID is bound to a canonical 64-char DID */
  private identityResolvedListeners: Set<(info: { hardwareId: string; canonicalId: string; displayName: string; publicKey?: string }) => void> = new Set();

  /** Listeners for Shake-to-Pair P2P signals */
  private shakePairListeners: Set<(peer: { identity_hash: string; display_name: string; public_key?: string; timestamp: number }) => void> = new Set();

  /** Listeners notified whenever the mesh peer topology mutates (real-time reactive bus) */
  private peerChangeListeners: Set<(peers: Map<string, MeshPeer>) => void> = new Set();

  private initialized = false;
  private unsubscribeNetwork: (() => void) | null = null;
  private aerSeq = 0;

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

    // Receive from ultrasonic SoundMesh acoustic modem channel (18.5 - 20.5 kHz)
    SoundMeshEngine.addPacketListener((pkt: SoundMeshPacket) => {
      if (!pkt.rawBytes || pkt.rawBytes.length === 0) return;
      const peerId = pkt.senderId || 'soundmesh-acoustic-node';
      this.updatePeer(peerId, 'soundmesh', pkt.rssiDb, undefined, 'Acoustic-Node');
      this.handleRawPacket(pkt.rawBytes, peerId, 'soundmesh');
    });

    // Receive from physical LoRa Serial / BLE bridge
    loraBridge.onPacketReceived((payload, rssi) => {
      this.updatePeer('lora-hardware-node', 'lora', rssi);
      this.handleRawPacket(payload, 'lora-hardware-node', 'lora');
    });

    // Receive from physical LoRa Meshtastic Wire Protocol Bridge
    loraMeshtastic.onPacket((pkt: LoRaPacket) => {
      const peerId = `lora-meshtastic-${pkt.from.toString(16).padStart(8, '0')}`;
      const nodeName = `LoRa-${pkt.from.toString(16).slice(-4).toUpperCase()}`;
      this.updatePeer(peerId, 'lora', pkt.rxRssi, undefined, nodeName);

      if (!pkt.payload || pkt.payload.length === 0) return;

      if (pkt.portnum === MeshtasticPortNum.RED_SOVEREIGN_MESH_APP) {
        // Native RED encrypted mesh frame — pass raw bytes directly.
        this.handleRawPacket(pkt.payload, peerId, 'lora');

      } else if (pkt.portnum === MeshtasticPortNum.TEXT_MESSAGE_APP) {
        // Plain-text UTF-8 Meshtastic message — wrap as RED JSON envelope.
        try {
          const text = new TextDecoder('utf-8', { fatal: false }).decode(pkt.payload).trim();
          if (text.length === 0) return;
          const envelope = JSON.stringify({
            sender: peerId,
            recipient: this.myIdentityHash || 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            content: text,
            msg_type: 'text',
            timestamp: Date.now(),
            id: `lora_text_${pkt.id ?? Date.now()}_${peerId.slice(-8)}`,
            transport: 'lora',
            is_meshtastic_native: true,
          });
          this.handleRawPacket(new TextEncoder().encode(envelope), peerId, 'lora');
        } catch (e) {
          console.warn('[MeshRouter][Meshtastic] Failed to decode TEXT_MESSAGE_APP:', e);
        }

      } else if (pkt.portnum === MeshtasticPortNum.RED_SOVEREIGN_VOCODER_APP) {
        // LPC vocoder voice burst from a RED node over Meshtastic physical LoRa.
        try {
          // Payload is raw LPC bytes — encode as base64 and wrap as P2P voice burst.
          const b64 = btoa(String.fromCharCode(...pkt.payload));
          const envelope = JSON.stringify({
            sender: peerId,
            recipient: this.myIdentityHash || 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            msg_type: 'p2p_voice_burst',
            audio_b64: b64,
            duration: Math.round((pkt.payload.length / 150) * 10) / 10, // ~150 B/s @ 1.2 kbps LPC-10
            channel: 'LORA · TÁCTICO',
            timestamp: Date.now(),
            id: `lora_vox_${pkt.id ?? Date.now()}_${peerId.slice(-8)}`,
            transport: 'lora',
            is_meshtastic_native: true,
          });
          this.handleRawPacket(new TextEncoder().encode(envelope), peerId, 'lora');
        } catch (e) {
          console.warn('[MeshRouter][Meshtastic] Failed to dispatch RED_SOVEREIGN_VOCODER_APP:', e);
        }

      } else if (pkt.portnum === MeshtasticPortNum.POSITION_APP) {
        // GPS position already decoded by LoRaMeshtasticBridge into knownNodes.
        // Emit a lightweight radar-update CustomEvent for the UI map layer.
        if (typeof window !== 'undefined') {
          try {
            const node = loraMeshtastic.getKnownNodes().find(n => n.nodeNum === pkt.from);
            if (node && node.latitude !== undefined && node.longitude !== undefined) {
              window.dispatchEvent(new CustomEvent('red_radar_position_update', {
                detail: {
                  peer_id: peerId,
                  node_num: pkt.from,
                  latitude: node.latitude,
                  longitude: node.longitude,
                  altitude: node.altitude,
                  battery_level: node.batteryLevel,
                  rssi: pkt.rxRssi,
                  timestamp: Date.now(),
                }
              }));
            }
          } catch (e) {
            console.warn('[MeshRouter][Meshtastic] Failed to emit POSITION_APP radar event:', e);
          }
        }
      }
    });

    // Initialize Network Watcher for automatic transitions (WiFi <-> 4G/5G <-> Offline)
    networkWatcher.init();
    this.hasInternetAccess = networkWatcher.hasInternet;

    this.unsubscribeNetwork = networkWatcher.onChange((state: NetworkState) => {
      this.handleNetworkChange(state);
    });

    loraTdmaScheduler.setNodeId(myIdentityHash);
    loraTdmaScheduler.setTransmitHandler(async (bytes) => {
      return await loraMeshtastic.transmitRawBytes(bytes);
    });
    synapticMeshRouter.init();
    console.log('[MeshRouter] Initialized — identity:', myIdentityHash.slice(0, 12));
  }

  public updateIdentity(newIdentityHash: string) {
    if (!newIdentityHash || newIdentityHash === this.myIdentityHash) return;
    console.log(`[MeshRouter] Updating identity: ${this.myIdentityHash?.slice(0, 8)} -> ${newIdentityHash.slice(0, 8)}`);
    this.myIdentityHash = newIdentityHash;
    loraTdmaScheduler.setNodeId(newIdentityHash);
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

    // Automatically flush pending DTN store-and-forward queue when Sovereign Blind Relay connects
    blindRelay.onConnect(() => {
      console.log('[MeshRouter] Sovereign Blind Relay active — resetting timers and flushing pending DTN queue');
      dtnStorage.forceResetRetryTimers();
      this.flushPendingQueue(true).catch(() => {});
    });

    // Automatically flush pending DTN store-and-forward queue when MQTT connects/reconnects
    mqttRelay.onConnect(() => {
      console.log('[MeshRouter] Global MQTT relay active — resetting timers and flushing pending DTN queue');
      dtnStorage.forceResetRetryTimers();
      this.flushPendingQueue(true).catch(() => {});
    });

    // Schedule dedup cache purge every 5 minutes (clean previous if any)
    if (this.purgeInterval) clearInterval(this.purgeInterval);
    this.purgeInterval = setInterval(() => this.purgeDedup(), 5 * 60 * 1000);

    // Schedule periodic stale peer pruning (every 15 seconds)
    if (this.pruneInterval) clearInterval(this.pruneInterval);
    this.pruneInterval = setInterval(() => this.pruneStalePeers(), 15_000);

    // Actively retry unacknowledged DTN pending packets every 3 seconds for fast cellular/mesh recovery
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushInterval = setInterval(() => this.flushPendingQueue(), 3000);

    // Initial DTN flush on boot
    setTimeout(() => {
      dtnStorage.forceResetRetryTimers();
      this.flushPendingQueue(true);
    }, 1500);
  }

  public stop() {
    this.isStarted = false;
    if (this.purgeInterval) { clearInterval(this.purgeInterval); this.purgeInterval = null; }
    if (this.flushInterval) { clearInterval(this.flushInterval); this.flushInterval = null; }
    if (this.pruneInterval) { clearInterval(this.pruneInterval); this.pruneInterval = null; }
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
      // Force reset DTN backoff timers so pending packets flush immediately
      dtnStorage.forceResetRetryTimers();

      // Proactively refresh Sovereign Blind Relay, MQTT and WebSocket signaling and trigger ICE restarts for 4G/5G transitions
      blindRelay.reconnect();
      mqttRelay.reconnect();
      this.wifi?.reconnect(true).catch(() => {});

      // Flush persistent offline DTN queue immediately upon network restoration
      this.flushPendingQueue(true).catch(() => {});

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
   * Returns the original physical hardware address (e.g. BLE MAC) for a canonical DID or peer ID.
   */
  getHardwareId(id: string): string | undefined {
    if (!id) return undefined;
    const clean = normalizeIdentity(id);
    if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(id.trim())) {
      return id.trim().toUpperCase();
    }
    const peer = this.peers.get(clean) || this.peers.get(id);
    if (peer?.hardwareId) return peer.hardwareId.toUpperCase();
    for (const p of this.peers.values()) {
      if (p.canonicalId?.toLowerCase() === clean && p.hardwareId) {
        return p.hardwareId.toUpperCase();
      }
    }
    return undefined;
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
   * Subscribes to reactive peer topology mutations (additions, updates, removals).
   * Returns an unsubscribe cleanup function.
   */
  onPeersChange(cb: (peers: Map<string, MeshPeer>) => void): () => void {
    this.peerChangeListeners.add(cb);
    return () => this.peerChangeListeners.delete(cb);
  }

  private notifyPeersChange(): void {
    this.peerChangeListeners.forEach(listener => {
      try {
        listener(this.peers);
      } catch (err) {
        console.error('[MeshRouter] Error in peerChange listener:', err);
      }
    });
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
   * Transmite un pulso compacto de sincronización de fase de Kuramoto (1 byte)
   * sobre la malla táctica para acoplamiento de atractores de anillo y relojes TDMA.
   */
  async broadcastKuramotoPhase(): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      const phaseByte = ringAttractor.getKuramotoPhaseByte();
      const payloadObj = {
        type: 'KURAMOTO_PHASE_SYNC',
        phaseByte,
        confidence: 0.90,
        timestamp: Date.now()
      };
      const raw = new TextEncoder().encode(JSON.stringify(payloadObj));
      const packet = createPacket(
        this.myIdentityHash,
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        raw
      );
      packet.flags |= FLAG_KURAMOTO_SYNC;
      await this.broadcast(encode(packet));
    } catch (e) {
      console.warn('[MeshRouter] Failed to broadcast Kuramoto phase sync:', e);
    }
  }

  /**
   * Emite una micro-espiga neuromórfica AER ultra-compacta (<14 bytes)
   * Reduciendo el airtime en LoRa/BLE en un 90% (Brain-Cog / Loihi).
   */
  async broadcastAerSpike(domain: AerDomainCode, neuronId: number, value: number): Promise<boolean> {
    try {
      let shortIdNum = 0;
      if (this.myIdentityHash && this.myIdentityHash.length >= 8) {
        shortIdNum = parseInt(this.myIdentityHash.slice(0, 8), 16) >>> 0;
      }
      if (!shortIdNum || isNaN(shortIdNum)) {
        shortIdNum = ((Date.now() & 0xFFFFFFFF) >>> 0);
      }

      this.aerSeq = (this.aerSeq + 1) & 0xFF;
      const aerNonce = `aer_${shortIdNum.toString(16).padStart(8, '0')}_${this.aerSeq}`;
      this.seenNonces.set(aerNonce, Date.now());

      const spike: AerSpikeEvent = { domain, neuronId, value };
      const frame = encodeAerSpikeFrame(shortIdNum, this.aerSeq, 5, [spike]);

      synapticMeshRouter.recordAerSpikeEmitted(1);

      // 1. Envío ultrarrápido vía LoRa (ranura TDMA de control)
      const okLoRa = await this.sendViaLoRa(frame).catch(() => false);

      // 2. Difusión BLE ad-hoc
      await bluetoothTransport.send('broadcast', frame).catch(() => false);

      return okLoRa;
    } catch (e) {
      console.warn('[MeshRouter] Failed to broadcast AER spike:', e);
      return false;
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
        this.notifyPeersChange();
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
  async sendIdentityAnnounce(targetDeviceId?: string, transport?: MeshTransport): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      let displayName = 'Operador RED';
      let pubKey = '';
      let shortId = this.myIdentityHash.slice(0, 8);
      let kyberKey = '';
      let x25519Key = '';

      let bio = '';
      let phone = '';
      if (typeof window !== 'undefined') {
        displayName = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pubKey = localStorage.getItem('red_public_key') || this.myIdentityHash;
        shortId = localStorage.getItem('red_short_id') || this.myIdentityHash.slice(0, 8);
        bio = localStorage.getItem('red_bio') || localStorage.getItem('user_bio') || '';
        phone = localStorage.getItem('red_phoneNumber') || localStorage.getItem('user_phone_number') || '';
        kyberKey = localStorage.getItem('red_pqc_kyber_public_key') || '';
        x25519Key = localStorage.getItem('red_pqc_x25519_public_key') || '';
      }

      const payloadObj = {
        type: 'IDENTITY_ANNOUNCE',
        payload: {
          identity_hash: this.myIdentityHash,
          display_name: displayName,
          public_key: pubKey,
          kyber_public_key: kyberKey || undefined,
          x25519_public_key: x25519Key || undefined,
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
  async sendIdentityResponse(recipientHash: string, targetDeviceId?: string, transport?: MeshTransport): Promise<void> {
    try {
      if (!this.myIdentityHash) return;
      let displayName = 'Operador RED';
      let pubKey = '';
      let shortId = this.myIdentityHash.slice(0, 8);
      let kyberKey = '';
      let x25519Key = '';

      if (typeof window !== 'undefined') {
        displayName = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pubKey = localStorage.getItem('red_public_key') || this.myIdentityHash;
        shortId = localStorage.getItem('red_short_id') || this.myIdentityHash.slice(0, 8);
        kyberKey = localStorage.getItem('red_pqc_kyber_public_key') || '';
        x25519Key = localStorage.getItem('red_pqc_x25519_public_key') || '';
      }

      const payloadObj = {
        type: 'IDENTITY_RESPONSE',
        payload: {
          identity_hash: this.myIdentityHash,
          display_name: displayName,
          public_key: pubKey,
          kyber_public_key: kyberKey || undefined,
          x25519_public_key: x25519Key || undefined,
          short_id: shortId,
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
  private async sendIdentityRequest(targetDeviceId?: string, transport?: MeshTransport): Promise<void> {
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

  // ─── RED-Sync BSP v2: Active State Synchronization Protocol ───────────────

  private lastSyncTimestamps: Map<string, number> = new Map();

  /**
   * Initiates active vector-clock state synchronization with a peer upon connection.
   */
  public async initiateSyncWithPeer(peerId: string, force = false) {
    if (!peerId || !this.myIdentityHash || peerId === this.myIdentityHash) return;
    const canonicalPeer = this.getCanonicalId(peerId);
    if (!canonicalPeer || canonicalPeer.length < 8) return;

    const now = Date.now();
    const lastSync = this.lastSyncTimestamps.get(canonicalPeer) || 0;
    if (!force && now - lastSync < 45_000) {
      // Cooldown active: avoid sync storm
      return;
    }
    this.lastSyncTimestamps.set(canonicalPeer, now);

    let lastTimestamp = 0;
    let lastMsgId: string | undefined = undefined;

    if (typeof window !== 'undefined') {
      try {
        const keys = [
          `red_web_messages_${canonicalPeer}`,
          `red_web_messages_${canonicalPeer.slice(0, 8)}`
        ];
        for (const k of keys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const msgs = JSON.parse(raw);
            if (Array.isArray(msgs) && msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              if (last && last.timestamp) {
                const ts = last.timestamp > 1e11 ? last.timestamp : last.timestamp * 1000;
                if (ts > lastTimestamp) {
                  lastTimestamp = ts;
                  lastMsgId = last.id;
                }
              }
            }
          }
        }
      } catch {}
    }

    const queryPayload = {
      type: 'SYNC_STATE_QUERY',
      payload: {
        requester: this.myIdentityHash,
        target: canonicalPeer,
        last_timestamp: lastTimestamp,
        last_msg_id: lastMsgId,
        timestamp: Date.now(),
      }
    };

    const encoded = new TextEncoder().encode(JSON.stringify(queryPayload));
    const packet = createPacket(this.myIdentityHash, canonicalPeer, encoded);
    console.log(`[MeshRouter] 🔄 RED-Sync: Sent SYNC_STATE_QUERY to ${canonicalPeer.slice(0, 8)} (last ts: ${lastTimestamp})`);
    await this.forwardPacket(packet, null).catch(() => {});
  }

  public async handleSyncStateQuery(senderHash: string, queryPayload: any, fromTransportId?: string, transportType?: MeshTransport) {
    const canonicalSender = this.getCanonicalId(senderHash);
    const lastTimestamp = queryPayload.last_timestamp || 0;
    if (fromTransportId) {
      this.bindDeviceToCanonical(fromTransportId, canonicalSender);
    }

    // [BUG-09 FIX] Verificar que el solicitante sea un contacto autorizado antes de responder.
    // Un nodo adversario no puede enviar SYNC_STATE_QUERY para extraer el historial.
    let isAuthorized = false;
    if (typeof window !== 'undefined') {
      try {
        const storedContacts = localStorage.getItem('red_web_contacts');
        if (storedContacts) {
          const contacts: any[] = JSON.parse(storedContacts);
          isAuthorized = contacts.some(c =>
            c && c.identity_hash &&
            (c.identity_hash.toLowerCase() === canonicalSender.toLowerCase() ||
             (canonicalSender.length >= 8 && c.identity_hash.toLowerCase().startsWith(canonicalSender.slice(0, 8).toLowerCase())))
          );
        }
      } catch {}
    }

    if (!isAuthorized) {
      console.warn(`[MeshRouter][Security] SYNC_STATE_QUERY rechazado de peer no autorizado: ${canonicalSender.slice(0, 12)}`);
      return;
    }

    const missingMsgs: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const keys = [
          `red_web_messages_${canonicalSender}`,
          `red_web_messages_${canonicalSender.slice(0, 8)}`
        ];
        for (const k of keys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const msgs = JSON.parse(raw);
            if (Array.isArray(msgs)) {
              for (const m of msgs) {
                const mTs = m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000;
                if (mTs > lastTimestamp && (m.sender === this.myIdentityHash || m.isOutgoing)) {
                  missingMsgs.push(m);
                }
              }
            }
          }
        }
      } catch {}
    }

    const dtnItems = dtnStorage.getItemsToRetry(true);
    for (const item of dtnItems) {
      if (item.targetRecipient === canonicalSender || (canonicalSender.length >= 8 && item.targetRecipient.startsWith(canonicalSender.slice(0, 8)))) {
        try {
          const meshPkt = dtnStorage.toMeshPacket(item);
          const str = new TextDecoder().decode(meshPkt.payload);
          if (str.startsWith('{')) {
            const parsed = JSON.parse(str);
            if (!missingMsgs.some(m => m.id === parsed.id)) {
              missingMsgs.push(parsed);
            }
          }
        } catch {}
      }
    }

    if (missingMsgs.length === 0) {
      console.log(`[MeshRouter] 🔄 RED-Sync: No missing messages to sync for ${canonicalSender.slice(0, 8)}`);
      return;
    }

    const batch = missingMsgs.slice(-50);
    const batchPayload = {
      type: 'SYNC_STATE_BATCH',
      payload: {
        sender: this.myIdentityHash,
        recipient: canonicalSender,
        messages: batch,
        timestamp: Date.now(),
      }
    };

    const encoded = new TextEncoder().encode(JSON.stringify(batchPayload));
    const packet = createPacket(this.myIdentityHash, canonicalSender, encoded);
    console.log(`[MeshRouter] ⚡ RED-Sync: Pushing ${batch.length} missing messages to ${canonicalSender.slice(0, 8)} via SYNC_STATE_BATCH`);
    await this.forwardPacket(packet, null).catch(() => {});
  }

  public async handleSyncStateBatch(senderHash: string, batchPayload: any) {
    const canonicalSender = this.getCanonicalId(senderHash);
    const messages = batchPayload.messages;
    if (!Array.isArray(messages) || messages.length === 0) return;

    console.log(`[MeshRouter] 📥 RED-Sync: Received ${messages.length} messages from ${canonicalSender.slice(0, 8)}`);
    const receivedIds: string[] = [];

    for (const msg of messages) {
      if (!msg || !msg.id) continue;
      receivedIds.push(msg.id);

      const taggedMsg = {
        ...msg,
        is_synced_batch: true,
        is_historical_sync: true
      };

      const syntheticPacket: MeshPacket = {
        recipient: this.myIdentityHash,
        sender: canonicalSender,
        ttl: 1,
        flags: 0,
        timestamp: msg.timestamp || Date.now(),
        nonce: msg.id,
        payload: new TextEncoder().encode(JSON.stringify(taggedMsg)),
      };

      this.localDeliveryHandlers.forEach(h => {
        try { h(syntheticPacket); } catch {}
      });
    }

    const ackPayload = {
      type: 'SYNC_STATE_ACK',
      payload: {
        sender: this.myIdentityHash,
        recipient: canonicalSender,
        received_ids: receivedIds,
        timestamp: Date.now(),
      }
    };

    const encoded = new TextEncoder().encode(JSON.stringify(ackPayload));
    const ackPacket = createPacket(this.myIdentityHash, canonicalSender, encoded);
    await this.forwardPacket(ackPacket, null).catch(() => {});
  }

  public handleSyncStateAck(ackPayload: any) {
    const receivedIds: string[] = ackPayload.received_ids || [];
    if (!Array.isArray(receivedIds) || receivedIds.length === 0) return;

    for (const id of receivedIds) {
      dtnStorage.remove(id);
    }
    console.log(`[MeshRouter] ✅ RED-Sync: Confirmed delivery of ${receivedIds.length} synced messages`);
  }

  // ─── Sending ────────────────────────────────────────────────────────────────

  /**
   * Send a payload to a specific recipient identity hash.
   * Tracks delivery in the persistent DTN queue until end-to-end DELIVERY_ACK is confirmed.
   */
  async send(recipientHash: string, payload: Uint8Array): Promise<'sent' | 'queued' | 'failed'> {
    const canonicalRecipient = this.getCanonicalId(recipientHash);

    const isBroadcast =
      canonicalRecipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
      canonicalRecipient === '0000000000000000000000000000000000000000000000000000000000000000';

    let isProtocol = false;
    try {
      const str = new TextDecoder().decode(payload);
      if (str.includes('DELIVERY_ACK') || str.includes('IDENTITY_ANNOUNCE') || str.includes('IDENTITY_RESPONSE') || str.includes(PQC_TYPE_KEY_ANNOUNCE)) {
        isProtocol = true;
      }
    } catch {}

    let finalPayload = payload;
    let packetFlags = 0x01; // default encrypted

    // ── NIST FIPS 203 ML-KEM-768 + X25519 HPKE Post-Quantum Encapsulation ──
    if (!isBroadcast && !isProtocol) {
      const peer = this.peers.get(canonicalRecipient) || this.peers.get(recipientHash);
      let targetKyber = peer?.kyberPublicKey;
      let targetX25519 = peer?.x25519PublicKey || peer?.publicKey;

      if (!targetKyber && typeof window !== 'undefined') {
        try {
          const rawConts = localStorage.getItem('red_web_contacts');
          if (rawConts) {
            const conts = JSON.parse(rawConts);
            const contact = conts.find((c: any) => {
              const cH = normalizeIdentity(c.identity_hash || '');
              return cH === canonicalRecipient || (canonicalRecipient.length >= 8 && cH.startsWith(canonicalRecipient.slice(0, 8)));
            });
            if (contact?.kyber_public_key) {
              targetKyber = contact.kyber_public_key;
              targetX25519 = contact.x25519_public_key || contact.public_key || targetX25519;
            }
          }
        } catch {}
      }

      if (targetKyber && targetX25519) {
        try {
          const { PqcCryptoEngine } = await import('../crypto/PqcCryptoEngine');
          finalPayload = await PqcCryptoEngine.encryptPayload(payload, targetKyber, targetX25519);
          packetFlags = 0x01 | 0x20; // FLAG_ENCRYPTED | FLAG_PQC_ENCRYPTED
          console.log(`[MeshRouter] 🛡️ Packet encapsulated with NIST ML-KEM-768 PQC container (${finalPayload.length} bytes) for ${canonicalRecipient.slice(0, 8)}`);
        } catch (pqcErr) {
          console.warn('[MeshRouter] PQC encapsulation fallback to standard payload:', pqcErr);
          finalPayload = payload;
          packetFlags = 0x01;
        }
      }
    }

    const packet = createPacket(this.myIdentityHash, canonicalRecipient, finalPayload, { flags: packetFlags });

    // Multi-Path Packet Bonding (Cauchy GF(256) 3-of-5 Erasure Coding):
    // For large payloads (> 512 bytes) when multiple interfaces are active, dispatch bonded shards concurrently
    const hasMultipleTransports = (this.peers.size > 0 && (this.wifi?.onlinePeers.size || blindRelay.isConnected || this.hasInternetAccess)) ||
                                  (this.peers.size >= 2);

    if (!isBroadcast && !isProtocol && finalPayload.length > 512 && hasMultipleTransports) {
      return this.sendBonded(canonicalRecipient, finalPayload);
    }

    return this.forwardPacket(packet, null);
  }

  /**
   * Dispatches a large payload across concurrent network bearers (WiFi/BlindRelay + BLE + LoRa)
   * using 3-of-5 Cauchy Reed-Solomon Erasure Coding (tolera 40% de pérdida total de enlaces).
   */
  async sendBonded(recipientHash: string, payload: Uint8Array): Promise<'sent' | 'queued' | 'failed'> {
    const canonicalRecipient = this.getCanonicalId(recipientHash);
    const packedShards = MultipathBondingEngine.bondAndPack(payload, 3, 2);

    const baseNonce = `bond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Create 5 discrete MeshPackets, each bearing a systematic or parity shard
    const shardPackets = packedShards.map((shardBytes, idx) => {
      const p = createPacket(this.myIdentityHash, canonicalRecipient, shardBytes);
      p.nonce = `${baseNonce}_s${idx}`;
      return p;
    });

    // Enqueue original unified packet in persistent DTN store-and-forward queue
    const originalPacket = createPacket(this.myIdentityHash, canonicalRecipient, payload);
    originalPacket.nonce = baseNonce;
    dtnStorage.enqueue(originalPacket, 5);

    const blePeers = Array.from(this.peers.entries()).filter(([_, p]) => p.transport === 'ble');
    const wifiActive = this.wifi && (this.wifi.onlinePeers.size > 0 || blindRelay.isConnected || this.hasInternetAccess);
    let anyShardSent = false;

    // Shards 0 & 1: High-bandwidth WAN / Sovereign Blind Relay
    if (wifiActive) {
      this.wifi?.send(canonicalRecipient, encode(shardPackets[0])).catch(() => {});
      this.wifi?.send(canonicalRecipient, encode(shardPackets[1])).catch(() => {});
      anyShardSent = true;
    } else if (blePeers.length > 0) {
      bluetoothTransport.send(blePeers[0][0], encode(shardPackets[0])).catch(() => {});
      bluetoothTransport.send(blePeers[0][0], encode(shardPackets[1])).catch(() => {});
      anyShardSent = true;
    }

    // Shard 2: Direct WebRTC DataChannel if connected, otherwise WAN or BLE
    if (this.wifi?.onlinePeers.has(canonicalRecipient)) {
      this.wifi.send(canonicalRecipient, encode(shardPackets[2])).catch(() => {});
      anyShardSent = true;
    } else if (wifiActive) {
      this.wifi?.send(canonicalRecipient, encode(shardPackets[2])).catch(() => {});
      anyShardSent = true;
    } else if (blePeers.length > 0) {
      bluetoothTransport.send(blePeers[0][0], encode(shardPackets[2])).catch(() => {});
      anyShardSent = true;
    }

    // Shard 3: Local BLE Mesh Neighbor
    if (blePeers.length > 0) {
      bluetoothTransport.send(blePeers[0][0], encode(shardPackets[3])).catch(() => {});
      anyShardSent = true;
    } else if (wifiActive) {
      this.wifi?.send(canonicalRecipient, encode(shardPackets[3])).catch(() => {});
      anyShardSent = true;
    }

    // Shard 4: LoRa RF or secondary BLE neighbor / fallback
    if (loraBridge.isConnected) {
      loraBridge.sendPacket(encode(shardPackets[4])).catch(() => {});
      anyShardSent = true;
    } else if (blePeers.length > 1) {
      bluetoothTransport.send(blePeers[1][0], encode(shardPackets[4])).catch(() => {});
      anyShardSent = true;
    } else if (wifiActive) {
      this.wifi?.send(canonicalRecipient, encode(shardPackets[4])).catch(() => {});
      anyShardSent = true;
    }

    dtnStorage.markAttempt(originalPacket.nonce, false);

    console.log(`[MeshRouter] 🚀 Multipath Bonding: Dispatched 5 shards (3 data + 2 parity) for ${canonicalRecipient.slice(0, 8)} across available bearers (sent=${anyShardSent})`);
    return anyShardSent ? 'sent' : 'queued';
  }

  /**
   * Emite y difunde una feromona de enjambre (Swarm Pheromone) a través de la red mesh.
   * Permite señalización estigmérgica sin servidor (ALARM, TRAIL, AGGREGATION).
   */
  async broadcastPheromone(
    type: SwarmPheromoneType,
    intensity = 1.0,
    notes?: string,
    geohash?: string,
    coords?: { xMeters?: number; yMeters?: number }
  ): Promise<boolean> {
    const ph = dtnMushroomBody.emitPheromone(type, intensity, notes, coords, geohash);
    const envelope = {
      type: 'SWARM_PHEROMONE',
      sender: this.myIdentityHash,
      timestamp: Date.now(),
      pheromone: ph,
    };
    const payload = new TextEncoder().encode(JSON.stringify(envelope));
    const sentCount = await this.broadcast(payload);
    console.log(`[MeshRouter] 🍄 Broadcasted Swarm Pheromone ${type} (geohash: ${geohash || 'global'}) to ${sentCount} peers`);
    return sentCount > 0;
  }

  /**
   * Broadcast a raw payload to ALL connected peers (mesh flood) and WAN relays.
   * Throttled by CognitiveRadioArbiter to prevent battery exhaustion during flood storms.
   */
  async broadcast(payload: Uint8Array, exceptPeer?: string): Promise<number> {
    let sent = 0;
    const decision = cognitiveArbiter.getLastDecision();

    // If Jamming EW is active in RF, emit broadcast via ultrasonic SoundMesh
    if (decision.isElectronicWarfareActive && payload.length <= 255) {
      SoundMeshEngine.transmitPayload(payload).catch(() => {});
    }

    // LPI / LPD Micro-Burst queueing when stealth transmission mode is active
    if (tacticalMicroBurst.getTelemetry().isLpiModeActive && payload.length > 0) {
      try {
        const hexSample = Array.from(payload.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
        tacticalMicroBurst.enqueuePayload(hexSample);
      } catch {}
    }

    // Giant Fiber Reflex: If EMCON / Radio Mute is active, suppress all RF broadcasts and divert
    if (giantFiberReflex.isRadioMuted()) {
      console.log('[MeshRouter] 🛡️ EMCON Active (Giant Fiber Reflex): Suppressing RF broadcast, diverting to SoundMesh');
      if (payload.length <= 255) {
        SoundMeshEngine.transmitPayload(payload).catch(() => {});
        return 1;
      }
      return 0;
    }

    // Filter peers if battery conservation is active (throttle dense flood)
    let peersList = Array.from(this.peers.entries());
    if (decision.batteryConservationMode && peersList.length > 3) {
      peersList = peersList.slice(0, 3); // Restrict to top 3 neighbors in critical battery
    }

    // Bio-Inspired Connectome Percolation (Murthy Lab Rich-Club & Synaptic Pruning)
    let isEmergency = false;
    try {
      const preview = new TextDecoder().decode(payload.slice(0, 60));
      if (preview.includes('SOS') || preview.includes('beacon') || preview.includes('CBRN') || preview.includes('amber')) {
        isEmergency = true;
      }
    } catch {}

    const candidateList = peersList.map(([id, peer]) => ({ id, peer }));
    const { selectedPeers } = synapticMeshRouter.selectBroadcastPeers(
      candidateList,
      exceptPeer,
      isEmergency
    );

    for (const item of selectedPeers) {
      const peerId = item.id;
      const peer = item.peer;
      const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora' | 'soundmesh') || 'ble', payload);
      if (ok) sent++;
    }

    // Transmisión broadcast física por Radiofrecuencia LoRa (Semtech SX1262 / Meshtastic)
    if (exceptPeer !== 'lora' && (loraBridge.isConnected || loraMeshtastic.isRadioConnected())) {
      try {
        const okLoRa = await this.sendViaLoRa(payload);
        if (okLoRa) sent++;
      } catch (err) {
        console.warn('[MeshRouter] Error en difusión broadcast por LoRa RF:', err);
      }
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
      } else if (payload.length > 0) {
        // Raw JSON or structured packet broadcast (e.g. creq_bc, identity handshakes)
        let target = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        try {
          const str = new TextDecoder().decode(payload);
          if (str.startsWith('{')) {
            const parsed = JSON.parse(str);
            if (parsed.recipient && parsed.recipient.length >= 16) target = parsed.recipient;
            else if (parsed.target_hash && parsed.target_hash.length >= 16) target = parsed.target_hash;
          }
        } catch {}
        this.wifi?.send(target, payload).catch(() => {});
      }
    } catch {}

    // [BUG-08 FIX] Si no hay peers disponibles, encolar en DTN SOLO si es un paquete crítico de emergencia.
    // Telemetría efímera, pings y anuncios de capacidad (HIVE_CAPACITY_AD) NUNCA deben persistirse en DTN.
    if (sent === 0) {
      try {
        const packet = decode(payload);
        if (packet) {
          let isEphemeral = false;
          let isEmergency = false;
          try {
            const preview = new TextDecoder().decode(packet.payload.slice(0, 100));
            if (preview.includes('HIVE_CAPACITY_AD') || preview.includes('PING') || preview.includes('SHAKE_PAIR') || preview.includes('BEACON_POLL')) {
              isEphemeral = true;
            }
            if (preview.includes('SOS') || preview.includes('AMBER') || preview.includes('CBRN') || preview.includes('beacon')) {
              isEmergency = true;
            }
          } catch {}

          const lowerNonce = packet.nonce.toLowerCase();
          if (lowerNonce.includes('sos') || lowerNonce.includes('amber') || lowerNonce.includes('cbrn') || lowerNonce.includes('beacon')) {
            isEmergency = true;
          }

          if (!isEphemeral && isEmergency) {
            dtnStorage.enqueue(packet, 10); // priority 10 = broadcast/SOS
            console.warn('[MeshRouter] broadcast() de emergencia sin peers — guardado en DTN para reintento');
          }
        }
      } catch {}
    }

    return sent;
  }

  // ─── Receiving & Relaying ───────────────────────────────────────────────────

  private async handleRawPacket(raw: Uint8Array, fromTransportId?: string, transportType?: MeshTransport) {
    // 0.0 NEUROMORPHIC AER MICRO-SPIKE FAST-PATH (Magic 0xAE51)
    if (raw && raw.length >= 14 && raw[0] === 0xAE && raw[1] === 0x51) {
      const aerFrame = decodeAerSpikeFrame(raw);
      if (aerFrame) {
        const senderShortHex = aerFrame.senderShortId.toString(16).padStart(8, '0');
        const aerNonce = `aer_${senderShortHex}_${aerFrame.seq}`;

        // Deduplicación de espigas: prevenir bucles infinitos y ecos
        if (this.seenNonces.has(aerNonce)) {
          return;
        }
        this.seenNonces.set(aerNonce, Date.now());

        for (const spike of aerFrame.spikes) {
          synapticMeshRouter.recordAerSpikeReceived(spike, senderShortHex);

          // Ruteo biológico instantáneo según dominio somático
          if (spike.domain === AerDomainCode.CX_COMPASS_HEADING) {
            const headingDeg = spike.value >= 0 && spike.value < 360 ? spike.value : ((spike.value & 0xFF) * 360 / 256);
            synapticMeshRouter.touchPeer(senderShortHex, 75, headingDeg);
          } else if (spike.domain === AerDomainCode.KURAMOTO_PHASE_PULSE) {
            ringAttractor.injectRemoteKuramotoPhase(
              senderShortHex,
              spike.value & 0xFF,
              Date.now(),
              0.90
            );
          } else if (spike.domain === AerDomainCode.EW_JAMMING_DETECTED) {
            console.warn(`[MeshRouter] 🛡️ Alerta AER: Interferencia EW Jamming detectada por nodo ${senderShortHex}`);
            giantFiberReflex.triggerEscape('EW_JAMMING');
            const targetCh = spike.value < 8 ? `lora_ch_${spike.value}` : 'lora_ch_0';
            dtnMushroomBody.applyDopaminergicNeuromodulation('PPL1', 0.85, targetCh);
          } else if (spike.domain === AerDomainCode.CBRN_RADIATION_ALERT) {
            console.warn(`[MeshRouter] ☢️ Alerta AER: Salto CBRN recibido de nodo ${senderShortHex} (Nivel: ${spike.value})`);
          }
        }

        // Reenvío Multi-Salto Neuromórfico (Relay con decaimiento de TTL)
        if (aerFrame.ttl > 1) {
          const relayedFrame = encodeAerSpikeFrame(
            aerFrame.senderShortId,
            aerFrame.seq,
            aerFrame.ttl - 1,
            aerFrame.spikes
          );
          this.sendViaLoRa(relayedFrame).catch(() => {});
          bluetoothTransport.send('broadcast', relayedFrame).catch(() => {});
        }

        return;
      }
    }

    // 0. MULTIPATH BONDING: Intercept raw wire bonded shards (Magic 0xBD01)
    if (raw.length >= 15 && raw[0] === 0xBD && raw[1] === 0x01) {
      const reconstructed = multipathBonding.ingestShard(raw);
      if (!reconstructed) {
        // Awaiting additional shards over concurrent bearers to satisfy GF(256) k-of-n threshold
        return;
      }
      raw = reconstructed;
    }

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
              nonce: parsed.id || (`nonce_${Date.now()}_${typeof crypto !== 'undefined' && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('') : Date.now().toString(36)}`),
              payload: cleanRaw,
            };
          }
        }
      } catch {}
    }

    if (!packet) {
      // 0. Hipocampo CA3: Intentar rescate de paquete corrupto / mutilado por jamming RF
      try {
        const hippocampal = HippocampalEpisodicEngine.getInstance();
        let fragmentInput: string | Uint8Array = raw;
        try {
          fragmentInput = new TextDecoder('utf-8', { fatal: true }).decode(raw);
        } catch {
          fragmentInput = raw;
        }

        const reconstructed = hippocampal.attemptPatternCompletion({
          rawFragment: fragmentInput,
          corruptedFields: ['payload']
        });
        if (reconstructed.isSuccessfullyReconstructed && reconstructed.reconstructionConfidence >= 0.70) {
          const restored = reconstructed.restoredPacket;
          packet = {
            recipient: this.getCanonicalId(this.myIdentityHash || 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
            sender: this.getCanonicalId(restored.senderPeerId || fromTransportId || 'rescued_peer'),
            ttl: 10,
            flags: 0,
            timestamp: Date.now(),
            nonce: restored.id || `nonce_rescued_${Date.now().toString(36)}`,
            payload: new TextEncoder().encode(restored.decodedSummary),
          };
          console.log(`[MeshRouter] 🧬 Rescued corrupted packet via Hippocampal CA3 Pattern Completion (conf: ${Math.round(reconstructed.reconstructionConfidence * 100)}%)`);
        }
      } catch {}
    }

    if (!packet) {
      console.warn('[MeshRouter] Received malformed packet, ignoring');
      try { globalShield.recordMalformedPacket(fromTransportId || 'UNKNOWN'); } catch {}
      return;
    }

    // Dedup check
    if (this.isDuplicate(packet.nonce)) {
      slottedGossip.recordHeardFromPeer(packet.nonce);
      broadcastStormGuardEngine.recordPeerRelay(packet.nonce);
      try { globalShield.recordReplayAttack(packet.nonce, packet.sender || fromTransportId || 'PEER'); } catch {}
      return; // Already seen this packet — drop silently
    }
    this.markSeen(packet.nonce);
    slottedGossip.recordHeardFromPeer(packet.nonce);
    broadcastStormGuardEngine.recordPeerRelay(packet.nonce);

    // 0.0 ALINEACIÓN TEMPORAL DE MALLA (Lamport Clock Skew PLL)
    if (packet.sender && packet.timestamp) {
      try {
        LamportMeshClockEngine.getInstance().recordPeerTime(packet.sender, packet.timestamp);
      } catch {}
    }

    // Memorización episódica bio-cibernética en CA3
    try {
      const hippocampal = HippocampalEpisodicEngine.getInstance();
      let preview = '';
      try {
        preview = new TextDecoder('utf-8', { fatal: true }).decode(packet.payload.slice(0, 100));
      } catch {
        preview = Array.from(packet.payload.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      hippocampal.memorizePacket({
        id: packet.nonce,
        senderPeerId: packet.sender,
        channel: 'mesh_rf',
        payloadType: preview.includes('type') ? 'structured_json' : 'raw_binary',
        geohashPrefix: 'geo_mesh',
        summary: preview.slice(0, 60),
      });
    } catch {}

    // 0.0 CRITICALIDAD DE ENJAMBRE (SOC): Registrar recepción de paquete para Branching Ratio sigma
    try {
      swarmCriticality.recordPacketReceived(1);
    } catch {}

    // 0.0b STDP 3-FACTORES (Mushroom Body): Registrar coincidencia pre/post en canal RF activo
    try {
      dtnMushroomBody.recordPrePostCoincidence('lora_ch_0', 1.0);
    } catch {}

    // Bind packet sender to transport ID if provided
    if (packet.sender && packet.sender.length === 64) {
      if (fromTransportId) {
        this.bindDeviceToCanonical(fromTransportId, packet.sender);
      }
      this.updatePeer(packet.sender, transportType || 'ble', undefined, packet.sender);
    }

    // 0.1 MULTIPATH BONDING: Intercept payload-level bonded shards (Magic 0xBD01)
    if (packet && packet.payload && packet.payload.length >= 15 && packet.payload[0] === 0xBD && packet.payload[1] === 0x01) {
      const isForMe = !packet.recipient ||
        packet.recipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
        (!!this.myIdentityHash && packet.recipient.toLowerCase() === this.myIdentityHash.toLowerCase());

      if (isForMe) {
        const reconstructedPayload = multipathBonding.ingestShard(packet.payload);
        if (!reconstructedPayload) {
          // Shard successfully ingested into reassembly buffer; awaiting k shards for complete reconstruction
          return;
        }
        packet.payload = reconstructedPayload;
      }
    }

    // 0.2 NIST FIPS 203 ML-KEM-768 PQC HYBRID DECAPSULATION
    const isPqcEncrypted = (packet.flags & 0x20) !== 0 ||
      (packet.payload && packet.payload.length >= 1154 && packet.payload[0] === 0x50 && packet.payload[1] === 0x51 && packet.payload[2] === 0x43 && packet.payload[3] === 0x31);

    if (isPqcEncrypted) {
      const isForMe = !packet.recipient ||
        packet.recipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
        (!!this.myIdentityHash && packet.recipient.toLowerCase() === this.myIdentityHash.toLowerCase());

      if (isForMe) {
        try {
          const { PqcCryptoEngine } = await import('../crypto/PqcCryptoEngine');
          const localKeys = PqcCryptoEngine.getLocalHybridKeyPair();
          if (localKeys?.kyberPrivateKeyHex && localKeys?.x25519PrivateKeyHex) {
            const decryptedBytes = await PqcCryptoEngine.decryptPayload(
              packet.payload,
              localKeys.kyberPrivateKeyHex,
              localKeys.x25519PrivateKeyHex
            );
            packet.payload = decryptedBytes;
            packet.isPqcEncrypted = true;
            console.log(`[MeshRouter] 🔓 Authenticated & Decrypted NIST ML-KEM-768 PQC container (${decryptedBytes.length} bytes) from ${packet.sender.slice(0, 8)}`);
          } else {
            console.warn('[MeshRouter] Received PQC packet but no local private hybrid keys available for decapsulation');
          }
        } catch (pqcDecErr) {
          console.error('[MeshRouter] ❌ PQC decapsulation / authentication failed:', pqcDecErr);
          try { globalShield.recordMalformedPacket(packet.sender || 'PQC_TAMPER'); } catch {}
          return; // Drop tampered / corrupted packet
        }
      }
    }

    let isHandshakeMsg = false;
    let isHandshakeTargetedToMe = true;
    let isLocationMsg = false;
    let isDeliveryAck = false;
    let ackNonce: string | null = null;
    let ackMessageId: string | null = null;
    let incomingMsgId: string | null = null;
    let payloadStr = '';

    try {
      payloadStr = new TextDecoder().decode(packet.payload);

      // 0. SWARM PHEROMONE INGESTION (Estigmergia de Malla P2P)
      if (payloadStr.startsWith('{') && (payloadStr.includes('SWARM_PHEROMONE') || payloadStr.includes('"pheromone"'))) {
        try {
          const parsed = JSON.parse(payloadStr);
          const ph = (parsed.type === 'SWARM_PHEROMONE' && parsed.pheromone) ? parsed.pheromone : (parsed.pheromone || parsed);
          if (ph && ph.type && ph.type !== 'SWARM_PHEROMONE') {
            dtnMushroomBody.ingestPheromone({
              id: ph.id || `ph_${ph.type.toLowerCase()}_${Date.now()}`,
              type: ph.type,
              intensity: typeof ph.intensity === 'number' ? ph.intensity : 1.0,
              originPeerId: ph.originPeerId || packet.sender,
              createdAt: ph.createdAt || Date.now(),
              ttlMs: ph.ttlMs || 15 * 60 * 1000,
              geohash: ph.geohash,
              xMeters: ph.xMeters,
              yMeters: ph.yMeters,
              notes: ph.notes,
            });
            console.log(`[MeshRouter] 🍄 Ingested P2P Swarm Pheromone ${ph.type} from ${packet.sender.slice(0, 8)}`);

            // Si es ALARMA, reforzar aversión sináptica inmediata para desviar tráfico de esa ruta
            if (ph.type === 'ALARM') {
              synapticMeshRouter.reinforceAversion(packet.sender, 0.4);
            }
          }
        } catch {}
      }

      // 0.1 KURAMOTO PHASE SYNCHRONIZATION (Consenso de Fase en Malla LoRa TDMA / Atractor de Anillo)
      if ((packet.flags & FLAG_KURAMOTO_SYNC) || (payloadStr.startsWith('{') && payloadStr.includes('KURAMOTO_PHASE_SYNC'))) {
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed.type === 'KURAMOTO_PHASE_SYNC' && typeof parsed.phaseByte === 'number') {
            ringAttractor.injectRemoteKuramotoPhase(
              packet.sender,
              parsed.phaseByte,
              packet.timestamp || Date.now(),
              parsed.confidence ?? 0.85
            );
          }
        } catch {}
      }

      // 0.2 NEUROMORPHIC AER SPIKE DISPATCH (MeshPacket Encapsulated)
      if ((packet.flags & FLAG_AER_SPIKE) !== 0) {
        try {
          if (packet.payload.length >= 14 && packet.payload[0] === 0xAE && packet.payload[1] === 0x51) {
            const aerFrame = decodeAerSpikeFrame(packet.payload);
            if (aerFrame) {
              const senderShortHex = aerFrame.senderShortId.toString(16).padStart(8, '0');
              for (const spike of aerFrame.spikes) {
                synapticMeshRouter.recordAerSpikeReceived(spike, senderShortHex);
              }
            }
          }
        } catch {}
      }

      // 1. DELIVERY_ACK Handling
      if (payloadStr.startsWith('{') && payloadStr.includes('DELIVERY_ACK')) {
        const parsed = JSON.parse(payloadStr);
        if (parsed.type === 'DELIVERY_ACK' && parsed.payload) {
          isDeliveryAck = true;
          ackNonce = parsed.payload.nonce;
          ackMessageId = parsed.payload.message_id;

          if (ackNonce) {
            dtnStorage.remove(ackNonce);
            // Refuerzo PAM en STDP 3-Factores ante entrega exitosa confirmada
            try {
              dtnMushroomBody.applyDopaminergicNeuromodulation('PAM', 0.40, 'lora_ch_0');
            } catch {}
            // Handle bonded packet ACK: remove parent bundle if shard was ACKed
            const bondPrefix = ackNonce.replace(/_s\d+$/, '');
            if (bondPrefix !== ackNonce) {
              dtnStorage.remove(bondPrefix);
            }
            console.log(`[MeshRouter] ✅ Received DELIVERY_ACK for nonce ${ackNonce.slice(0, 8)} — cleared from DTN storage`);
          }
          if (ackMessageId && ackMessageId !== ackNonce) {
            dtnStorage.remove(ackMessageId);
            const bondPrefixMsg = ackMessageId.replace(/_s\d+$/, '');
            if (bondPrefixMsg !== ackMessageId) {
              dtnStorage.remove(bondPrefixMsg);
            }
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

      // 1.5. LEO Satellite Mesh Relay Downlink Ingest
      if (payloadStr.includes('SAT_RELAY_V1|')) {
        import('./SatelliteMeshGatewayEngine').then(({ satelliteMeshGateway }) => {
          satelliteMeshGateway.processIncomingDownlink(payloadStr);
        }).catch(() => {});
        return; // Consumido por el motor satelital: evitar que se propague como mensaje de chat ordinario
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
            const peerKyberPk = idData.kyber_public_key || idData.kyberPublicKeyHex;
            const peerX25519Pk = idData.x25519_public_key || idData.x25519PublicKeyHex;
            const isGateway = !!(idData.capabilities?.is_gateway || idData.is_gateway);
            const hasInternet = !!(idData.capabilities?.has_internet || idData.has_internet);

            if (fromTransportId) {
              this.bindDeviceToCanonical(fromTransportId, peerHash, peerName, peerPk);
            }
            this.bindDeviceToCanonical(packet.sender, peerHash, peerName, peerPk);
            this.updatePeer(peerHash, transportType || 'ble', undefined, peerHash, peerName, peerPk, isGateway, hasInternet, peerKyberPk, peerX25519Pk);

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

      // 2.1 PQC Key Announcement Handling (PQC_KEY_ANNOUNCEMENT)
      if (payloadStr.startsWith('{') && payloadStr.includes(PQC_TYPE_KEY_ANNOUNCE)) {
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed.type === PQC_TYPE_KEY_ANNOUNCE) {
            const peerHash = normalizeIdentity(parsed.did || packet.sender);
            const kyberPub = parsed.kyberPublicKeyHex || parsed.kyber_public_key;
            const x25519Pub = parsed.x25519PublicKeyHex || parsed.x25519_public_key || parsed.publicKey;
            const nick = parsed.nickname || parsed.display_name;
            if (peerHash && kyberPub) {
              this.updatePeer(peerHash, transportType || 'ble', undefined, peerHash, nick, x25519Pub, undefined, undefined, kyberPub, x25519Pub);
              console.log(`[MeshRouter] 🔑 Registered PQC ML-KEM-768 public key for peer ${peerHash.slice(0, 8)}`);
            }
            return;
          }
        } catch {}
      }

      // 3. RED-Sync BSP v2 State Synchronization Handshake
      if (payloadStr.startsWith('{') && (payloadStr.includes('SYNC_STATE_QUERY') || payloadStr.includes('SYNC_STATE_BATCH') || payloadStr.includes('SYNC_STATE_ACK'))) {
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed.type === 'SYNC_STATE_QUERY' && parsed.payload) {
            this.handleSyncStateQuery(packet.sender, parsed.payload, fromTransportId, transportType).catch(() => {});
            return;
          }
          if (parsed.type === 'SYNC_STATE_BATCH' && parsed.payload) {
            this.handleSyncStateBatch(packet.sender, parsed.payload).catch(() => {});
            return;
          }
          if (parsed.type === 'SYNC_STATE_ACK' && parsed.payload) {
            this.handleSyncStateAck(parsed.payload);
            return;
          }
        } catch {}
      }

      // 4. Shake-to-Pair Real P2P Mesh Handshake
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
      if (payloadStr.includes('contact_request') || payloadStr.includes('contact_response')) {
        try {
          let parsedReq = JSON.parse(payloadStr);
          if (typeof parsedReq.content === 'string' && parsedReq.content.trim().startsWith('{')) {
            try {
              const inner = JSON.parse(parsedReq.content);
              parsedReq = { ...parsedReq, ...inner };
            } catch {}
          }
          const reqSender = parsedReq.sender_hash || parsedReq.sender;
          const reqName = parsedReq.sender_name || parsedReq.name;
          const reqPk = parsedReq.sender_pk || parsedReq.pk;
          const reqRecipient = parsedReq.recipient || parsedReq.target_hash;

          let currentMyHash = this.myIdentityHash;
          if (!currentMyHash && typeof window !== 'undefined') {
            currentMyHash = localStorage.getItem('red_identity_hash') || '';
          }

          const isBroadcastTarget = !reqRecipient || 
            reqRecipient === '*' || 
            reqRecipient === 'all' || 
            reqRecipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
            reqRecipient === '0000000000000000000000000000000000000000000000000000000000000000';

          const isTargetedToMe = isBroadcastTarget ||
            (!!currentMyHash && reqRecipient.toLowerCase() === currentMyHash.toLowerCase()) ||
            (!!currentMyHash && reqRecipient.length >= 8 && currentMyHash.toLowerCase().startsWith(reqRecipient.toLowerCase())) ||
            (!!currentMyHash && currentMyHash.length >= 8 && reqRecipient.toLowerCase().startsWith(currentMyHash.toLowerCase()));

          isHandshakeTargetedToMe = isTargetedToMe;

          if (isTargetedToMe && reqSender && payloadStr.includes('contact_request')) {
            if (fromTransportId) {
              this.bindDeviceToCanonical(fromTransportId, reqSender, reqName, reqPk);
            }
            this.bindDeviceToCanonical(packet.sender, reqSender, reqName, reqPk);
            this.updatePeer(reqSender, transportType || 'ble', undefined, reqSender, reqName, reqPk);
            // Auto-respond with identity response so sender immediately learns our MAC/DID binding
            this.sendIdentityResponse(reqSender, fromTransportId, transportType).catch(() => {});
          }
        } catch {}
      }

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

          // Inferencia Activa & Teoría de la Mente mPFC/TPJ
          try {
            const myLoc = TacticalLocationEngine.getLastKnownLocation() || { lat: 0, lon: 0 };
            const measuredRssi = peer?.rssi || -75;

            TheoryOfMindEpistemicEngine.getInstance().auditPeerReport({
              peerId: canonical,
              claimedLat: data.payload.lat,
              claimedLon: data.payload.lng,
              measuredRssi,
              timestamp: data.payload.timestamp || Date.now(),
              localLat: myLoc.lat || 0,
              localLon: myLoc.lon || 0,
            });

            PredictiveCortexEngine.getInstance().updatePeerPosition(
              canonical,
              data.payload.lat,
              data.payload.lng,
              data.payload.speed || 0,
              data.payload.heading || 0
            );
          } catch {}
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

    const isForMe = isBroadcast || isDirectlyToMe || (isLocationMsg && isBroadcast) || (isHandshakeMsg && isHandshakeTargetedToMe);

    if (isForMe) {
      // ── FINAL DELIVERY: packet is for us ──
      console.log(`[MeshRouter] Packet delivered locally from ${packet.sender.slice(0, 8)} (type: ${isHandshakeMsg ? 'handshake' : 'msg'})`);
      
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();

      // 1. Unconditional dispatch to local store / application handlers (SOS beacons, dead drops, chat, dApps, AI cortex)
      this.localDeliveryHandlers.forEach(h => {
        try { h(packet); } catch (err) { console.error('[MeshRouter] Handler error:', err); }
      });

      // 2. On native platform (Rust daemon active), bridge binary OnionPackets and Sled-bound JSON messages
      // Skip pure TS-exclusive protocol envelopes that the Rust deserializer discards
      const isTsExclusiveEnvelope =
        payloadStr.startsWith('SOS_BEACON_') ||
        payloadStr.startsWith('DEAD_DROP_') ||
        payloadStr.startsWith('SAT_RELAY_') ||
        payloadStr.startsWith('KURAMOTO_');

      if (isNative && !isTsExclusiveEnvelope) {
        this.deliverToRustNode(packet).catch(err => {
          console.warn('[MeshRouter] Non-blocking Rust node injection failed:', err?.message || err);
        });
      }

      // Emit DELIVERY_ACK to sender (unless broadcast packet or handshake)
      if (packet.sender && packet.sender !== this.myIdentityHash && !isBroadcast && !isHandshakeMsg && !isDeliveryAck) {
        (packet as any)._ackEmitted = true;
        this.sendDeliveryAck(packet.sender, packet.nonce, incomingMsgId || undefined).catch(() => {});
      }
    }

    // ── RELAY: Forward broadcast packets OR unicast packets addressed to someone else ──
    const shouldRelayPacket = (isBroadcast || !isForMe) && (packet.ttl > 0);
    if (shouldRelayPacket) {
      const forwarded = relay(packet);
      if (forwarded) {
        const encoded = encode(forwarded);

        // 1. Broadcast Storm Guard Engine: Bloom filter & adaptive TTL suppression in dense mesh
        const stormEval = broadcastStormGuardEngine.evaluateRelay(
          packet.nonce,
          packet.ttl !== undefined ? (20 - packet.ttl) : 1,
          forwarded.ttl,
          this.peers.size,
          encoded.length
        );
        if (!stormEval.shouldRelay) {
          console.log(`[MeshRouter] ⛈️ BroadcastStormGuard suppressed redundant relay for packet ${packet.nonce.slice(0, 8)}`);
          return;
        }

        // Apply adjusted TTL to prevent packet circulation beyond optimal topology depth
        if (stormEval.adjustedTtl > 0 && stormEval.adjustedTtl < forwarded.ttl) {
          forwarded.ttl = stormEval.adjustedTtl;
        }

        // 2. Slotted Backoff Gossip anti-storm suppression in dense RF topologies
        // SlottedGossip applies the stochastic channel backoff and verifies concurrent echoes without serial delays
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

    let isProtocol = false;
    try {
      const previewStr = new TextDecoder().decode(packet.payload.slice(0, 100));
      if (previewStr.includes('DELIVERY_ACK') || previewStr.includes('IDENTITY_ANNOUNCE') || previewStr.includes('IDENTITY_RESPONSE') || previewStr.includes('PQC_KEY') || previewStr.includes('KURAMOTO') || previewStr.includes('SWARM_PHEROMONE')) {
        isProtocol = true;
      }
    } catch {}

    // DTN Store-and-Forward Preventivo: Respaldar paquete unicast en almacén persistente
    // ANTES de evaluar rutas rápidas, garantizando recuperación si el enlace físico colapsa
    if (!isBroadcast && !isProtocol) {
      dtnStorage.enqueue(packet, (packet.flags & 0x01) !== 0 ? 9 : 4);
    }

    let anySent = false;

    // ─── 0. UNIFIED COGNITIVE RADIO EVALUATION (Unicast & Broadcast) ───
    const canonicalRecipient = !isBroadcast ? this.getCanonicalId(packet.recipient) : null;
    const directPeer = canonicalRecipient ? this.getPeerByAnyId(canonicalRecipient) : undefined;
    const isEmergency = isBroadcast && (packet.flags === 1 || packet.nonce.includes('sos') || packet.nonce.includes('beacon'));
    const decision = cognitiveArbiter.evaluateRoutingDecision(directPeer, encoded.length, isEmergency);

    // Giant Fiber Reflex: If EMCON / Radio Mute is active, suppress all RF broadcasts and divert
    if (giantFiberReflex.isRadioMuted()) {
      console.log('[MeshRouter] 🛡️ EMCON Active (Giant Fiber Reflex): Diverting packet via SoundMesh');
      if (encoded.length <= 255) {
        const ok = await SoundMeshEngine.transmitPayload(encoded);
        if (ok) {
          dtnStorage.markAttempt(packet.nonce, false);
          return 'sent';
        }
      }
      dtnStorage.enqueue(packet, 10);
      return 'queued';
    }

    // Global Cognitive Fallback A: Electronic Warfare / Jamming active in RF -> route via SoundMesh
    const jammingVector = dtnMushroomBody.getJammingEvasionVector();
    if ((decision.isElectronicWarfareActive || jammingVector.shouldHopChannel) && encoded.length <= 255) {
      console.log(`[MeshRouter] 🛡️ Jamming EW / Mushroom Body Avoidance Active: Routing via SoundMesh (Avoidance: ${jammingVector.highestAvoidanceScore})`);
      const ok = await SoundMeshEngine.transmitPayload(encoded);
      if (ok) {
        dtnStorage.markAttempt(packet.nonce, false);
        anySent = true;
        if (!isBroadcast) return 'sent';
      }
    }

    // ─── 1. SMART COGNITIVE UNICAST DIRECT ROUTING (Fast Path) ───
    if (!isBroadcast) {
      // Cognitive Fallback B: Long-distance target (>90m) or dedicated LoRa link -> LoRa RF
      if (decision.primaryBearer === 'LORA_RF') {
        const ok = await this.sendViaLoRa(encoded);
        if (ok) {
          console.log(`[MeshRouter] 📡 Cognitive Radio: Delivered via LoRa RF (${decision.rationale})`);
          dtnStorage.markAttempt(packet.nonce, false);
          return 'sent';
        }
      }

      if (directPeer) {
        // Direct Fast-Path 1: Direct WebRTC DataChannel (54 Mbps, <30ms)
        if (this.wifi && (directPeer.transport === 'wifi' || this.wifi.onlinePeers.has(canonicalRecipient!) || this.wifi.onlinePeers.has(directPeer.id))) {
          const targetId = this.wifi.onlinePeers.has(canonicalRecipient!) ? canonicalRecipient! : directPeer.id;
          const ok = await this.wifi.send(targetId, encoded);
          if (ok) {
            console.log(`[MeshRouter] ⚡ Fast-path: Delivered directly to ${canonicalRecipient!.slice(0, 8)} via WiFi Direct`);
            dtnStorage.markAttempt(packet.nonce, false);
            return 'sent';
          }
        }

        // Direct Fast-Path 2: Direct BLE GATT (<100ms) with LQS verification
        const lqs = directPeer.rssi ? bluetoothTransport.getLinkQuality(directPeer.id) : 70;
        if (lqs >= 20) {
          const bleTargetId = directPeer.id || canonicalRecipient!;
          const ok = await bluetoothTransport.send(bleTargetId, encoded);
          if (ok) {
            console.log(`[MeshRouter] 📶 Direct BLE send to ${canonicalRecipient!.slice(0, 8)} (LQS ${lqs}%)`);
            dtnStorage.markAttempt(packet.nonce, false);
            return 'sent';
          }
        }
      }

      // Fast-Path 3: Bio-Neuromorphic Synaptic Next-Hop (Murthy Lab Connectome Unicast)
      if (canonicalRecipient) {
        const candidateNeighbors = Array.from(this.peers.entries())
          .filter(([id, peer]) => {
            if (id === exceptPeer) return false;
            const lqs = peer.rssi ? bluetoothTransport.getLinkQuality(id) : 70;
            return lqs >= (decision.batteryConservationMode ? 50 : 15);
          })
          .map(([id, peer]) => ({ id, peer }));

        const optimalHop = synapticMeshRouter.getOptimalNextHop(canonicalRecipient, candidateNeighbors);
        if (optimalHop && optimalHop.id !== canonicalRecipient) {
          const hopPeer = optimalHop.peer;
          const hopWeight = synapticMeshRouter.getLink(optimalHop.id)?.weight ?? 0.30;
          const flowAttenuation = synapticMeshRouter.calculateEffectiveFlowAttenuation([hopWeight]);
          const isUrgent = (packet.flags & 0x01) !== 0 || packet.nonce.includes('sos') || packet.nonce.includes('cbrn');
          if (flowAttenuation >= 0.05 || isUrgent) {
            const ok = await this.sendToPeer(optimalHop.id, (hopPeer.transport as 'wifi' | 'ble' | 'lora' | 'soundmesh') || 'ble', encoded);
            if (ok) {
              console.log(`[MeshRouter] 🧠 Synaptic Connectome: Delivered unicast to ${canonicalRecipient.slice(0, 8)} via next-hop ${optimalHop.id.slice(0, 8)} (Flow: ${flowAttenuation})`);
              dtnStorage.markAttempt(packet.nonce, false);
              return 'sent';
            }
          }
        }
      }
    }

    // ─── 2. CONTROLLED MULTI-HOP FLOOD (Bio-Inspired Connectome Percolation & LQS-Filtered) ───
    // If not a direct peer or direct send failed, forward to connected neighbors with healthy links
    let peersToSend = Array.from(this.peers.entries())
      .filter(([id, peer]) => {
        if (id === exceptPeer) return false;
        // Don't waste radio energy on severely degraded links (LQS < 15% normal, < 50% in battery saver)
        const lqs = peer.rssi ? bluetoothTransport.getLinkQuality(id) : 70;
        return lqs >= (decision.batteryConservationMode ? 50 : 15);
      });

    // In critical battery conservation mode (<=15%), throttle multi-hop to top 3 best links
    if (decision.batteryConservationMode && peersToSend.length > 3) {
      peersToSend = peersToSend.slice(0, 3);
    }

    // Connectome Synaptic Pruning & Rich-Club Hub Routing
    const { selectedPeers: multiHopPeers } = synapticMeshRouter.selectBroadcastPeers(
      peersToSend.map(([id, peer]) => ({ id, peer })),
      exceptPeer,
      isEmergency
    );

    for (const item of multiHopPeers) {
      const peerId = item.id;
      const peer = item.peer;
      const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora' | 'soundmesh') || 'ble', encoded);
      if (ok) anySent = true;
    }

    // Difusión física por LoRa RF si el paquete es Broadcast o Emergencia crítica
    if ((isBroadcast || isEmergency) && exceptPeer !== 'lora' && (loraBridge.isConnected || loraMeshtastic.isRadioConnected())) {
      try {
        const okLoRa = await this.sendViaLoRa(encoded);
        if (okLoRa) anySent = true;
      } catch (err) {
        console.warn('[MeshRouter] Error en forwardPacket broadcast por LoRa RF:', err);
      }
    }

    // ─── 3. GLOBAL WAN / WebRTC / MQTT Blind Relay Transport ───
    // Attempt WAN relay uplink for both unicast and broadcast packets
    if (this.wifi) {
      const targetRecipient = !isBroadcast ? (canonicalRecipient || packet.recipient) : 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const ok = await this.wifi.send(targetRecipient, encoded);
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

    // ─── 5. ZERO-BALANCE CELLULAR DNS TUNNELING FALLBACK ───
    // If no local radio routes succeeded, attempt DNS tunneling query if on cellular.
    // Transmits all multipart fragments sequentially and marks anySent=true upon authoritative ACK.
    if (!anySent && !isBroadcast) {
      try {
        const dnsQueries = DnsTunnelEngine.packPayloadIntoDnsQuery(encoded);
        if (dnsQueries.length > 0) {
          let allSuccess = true;
          let lastAck = '';
          let lastLatency = 0;

          for (const query of dnsQueries) {
            const res = await DnsTunnelEngine.transmitDnsQuery(query);
            if (res.success && res.responseTxt && (res.responseTxt.startsWith('ACK') || res.responseTxt.startsWith('RED:'))) {
              lastAck = res.responseTxt;
              lastLatency = res.latencyMs;
            } else {
              allSuccess = false;
              break;
            }
          }

          if (allSuccess) {
            console.log(`[MeshRouter] 📡 Zero-Balance Carrier Bypass: Transmitted packet (${dnsQueries.length} DNS queries) via DNS Tunneling (${lastLatency}ms, server_ack=${lastAck})`);
            dtnStorage.markAttempt(packet.nonce, false);
            anySent = true;
            return 'sent';
          }
        }
      } catch (dnsErr) {
        console.warn('[MeshRouter] DNS tunneling fallback failed:', dnsErr);
      }
    }

    // ─── 6. AUTONOMOUS LEO SATELLITE GATEWAY FALLBACK & ORBITAL UPLINK ───
    // If no terrestrial routes succeeded, dispatch via LEO Satellite Gateway if in AOS or priority packet:
    // Notice: We enqueue in the satellite buffer for ground stations / transceivers, but also keep
    // the packet in the terrestrial DTN store-and-forward queue until an explicit ACK confirms delivery.
    if (!anySent && packet.sender !== 'SAT_GATEWAY') {
      try {
        const payloadStr = new TextDecoder().decode(packet.payload);
        const isSatProtocol = payloadStr.startsWith('SAT_BURST_V1:') ||
                              payloadStr.startsWith('SAT_RELAY_V1|') ||
                              payloadStr.startsWith('SAT_DOWNLINK_MSG:') ||
                              payloadStr.startsWith('SBD_V1|') ||
                              packet.nonce.startsWith('SAT-UPLINK');

        const isCriticalOrEmergency = (packet.flags & 0x01) !== 0 ||
                                     payloadStr.includes('SOS') ||
                                     payloadStr.includes('CBRN') ||
                                     packet.nonce.includes('sos');

        if (!isSatProtocol && isCriticalOrEmergency) {
          const { satelliteMeshGateway } = await import('./SatelliteMeshGatewayEngine');
          const satTelem = satelliteMeshGateway.getTelemetry();
          satelliteMeshGateway.enqueueOutboundUplink(payloadStr, 8);
          if (satTelem.isUplinkAvailable) {
            satelliteMeshGateway.triggerSatelliteBurst();
            console.log(`[MeshRouter] 🛰️ LEO Satellite Gateway Fallback: Dispatched packet to orbital uplink buffer (${satTelem.bestAvailableSatellite?.satelliteId || 'LEO'})`);
          }
        }
      } catch (err) {
        console.warn('[MeshRouter] Satellite gateway fallback error:', err);
      }
    }

    if (!isBroadcast && !isProtocol) {
      dtnStorage.markAttempt(packet.nonce, false);
    }

    if (anySent) {
      try {
        swarmCriticality.recordPacketRelayed(1);
      } catch {}
    }

    if (!anySent) {
      try {
        dtnMushroomBody.applyDopaminergicNeuromodulation('PPL1', 0.35, 'lora_ch_0');
      } catch {}
      console.log(`[MeshRouter] No reachable route — saved in persistent DTN queue for ${packet.recipient.slice(0, 8)}`);
      return 'queued';
    }

    return 'sent';
  }

  private async sendToPeer(
    peerId: string,
    transport: 'wifi' | 'ble' | 'lora' | 'soundmesh',
    payload: Uint8Array
  ): Promise<boolean> {
    const startTs = Date.now();
    try {
      let ok = false;
      if (transport === 'wifi' && this.wifi) {
        ok = await this.wifi.send(peerId, payload);
      } else if (transport === 'ble') {
        ok = await bluetoothTransport.send(peerId, payload);
      } else if (transport === 'lora') {
        ok = await this.sendViaLoRa(payload);
      } else if (transport === 'soundmesh') {
        ok = await SoundMeshEngine.transmitPayload(payload);
      }
      const rtt = Math.max(10, Date.now() - startTs);
      const peer = this.peers.get(peerId);
      const lqs = peer?.rssi ? bluetoothTransport.getLinkQuality(peerId) : 70;
      synapticMeshRouter.recordDeliveryResult(peerId, ok, rtt, lqs);
      return ok;
    } catch (e) {
      console.warn(`[MeshRouter] Send to ${peerId} via ${transport} failed:`, e);
      synapticMeshRouter.recordDeliveryResult(peerId, false, 500, 20);
    }
    return false;
  }

  private async sendViaLoRa(payload: Uint8Array): Promise<boolean> {
    try {
      let isEmergency = false;
      try {
        const decodedStr = new TextDecoder().decode(payload.slice(0, 40));
        if (decodedStr.includes('SOS') || decodedStr.includes('beacon') || decodedStr.includes('CBRN')) {
          isEmergency = true;
        }
      } catch {}

      // Si el enlace de hardware está activo, encapsular en trama ToRadio Protobuf compatible
      const framedPayload = (loraBridge.isConnected || loraMeshtastic.isRadioConnected())
        ? loraMeshtastic.framePacket({
            from: loraMeshtastic.getLocalNodeNum(),
            to: 0xFFFFFFFF,
            channel: 0,
            portnum: MeshtasticPortNum.RED_SOVEREIGN_MESH_APP,
            payload,
            id: (Date.now() & 0xFFFFFFFF) >>> 0,
            hopLimit: 3,
            wantAck: false
          })
        : payload;

      // Canalizar a través del planificador TDMA para mitigar colisiones ALOHA
      const okHardware = await loraTdmaScheduler.scheduleTransmission(framedPayload, isEmergency ? 10 : 5, isEmergency);
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

  public async flushPendingQueue(forceAll = false) {
    const items = dtnStorage.getItemsToRetry(forceAll);
    if (items.length === 0) return;

    let flushed = 0;
    for (const item of items) {
      const packet = dtnStorage.toMeshPacket(item);
      const res = await this.forwardPacket(packet, null);
      if (res === 'sent') {
        flushed++;
        // forwardPacket already recorded the transmission attempt and exponential backoff
        // via dtnStorage.markAttempt(packet.nonce, false).
        // The packet remains safely in DTN storage until DELIVERY_ACK arrives or MAX_DTN_RETRIES is met.
      }
    }

    if (flushed > 0) {
      console.log(`[MeshRouter] 🔄 Retransmitted ${flushed}/${items.length} DTN packets (awaiting DELIVERY_ACK or next backoff)`);
    }

    // Periodically purge dead expired packets (>30 days)
    dtnStorage.purgeExpired();
  }

  // ─── Peer Management ─────────────────────────────────────────────────────────

  addWifiPeer(peerId: string, canonicalId?: string, name?: string, isGateway = false, hasInternet = false) {
    const canonical = canonicalId || this.getCanonicalId(peerId);
    const isNewPeer = !this.peers.has(peerId) && !this.peers.has(canonical);
    this.updatePeer(peerId, 'wifi', undefined, canonical, name, undefined, isGateway, hasInternet);
    if (isNewPeer) {
      dtnStorage.forceResetForRecipient(canonical);
      this.flushPendingQueue(true);
      this.initiateSyncWithPeer(canonical).catch(() => {});
    }
  }

  addBlePeer(deviceId: string, rssi?: number, canonicalId?: string, name?: string, isGateway = false, hasInternet = false) {
    const canonical = canonicalId || this.getCanonicalId(deviceId);
    const isNewPeer = !this.peers.has(deviceId) && !this.peers.has(canonical);
    this.updatePeer(deviceId, 'ble', rssi, canonical, name, undefined, isGateway, hasInternet);
    if (isNewPeer) {
      dtnStorage.forceResetForRecipient(canonical);
      this.flushPendingQueue(true);
      this.initiateSyncWithPeer(canonical).catch(() => {});
    }
  }

  addLoraPeer(peerId: string, canonicalId?: string, name?: string) {
    const canonical = canonicalId || this.getCanonicalId(peerId);
    const isNewPeer = !this.peers.has(peerId) && !this.peers.has(canonical);
    this.updatePeer(peerId, 'lora', undefined, canonical, name);
    if (isNewPeer) {
      dtnStorage.forceResetForRecipient(canonical);
      this.flushPendingQueue(true);
      this.initiateSyncWithPeer(canonical).catch(() => {});
    }
  }

  removePeer(peerId: string) {
    let changed = false;
    if (this.peers.delete(peerId)) changed = true;
    this.activeGateways.delete(peerId);
    const canonical = this.deviceToCanonicalMap.get(peerId);
    if (canonical) {
      if (this.peers.delete(canonical)) changed = true;
      this.activeGateways.delete(canonical);
    }
    if (changed) {
      this.notifyPeersChange();
    }
  }

  /**
   * Poda proactiva de pares obsoletos según el tiempo transcurrido desde su última señal (lastSeen)
   * y el tipo de transporte físico (WiFi: 30s, BLE: 45s, LoRa: 180s).
   */
  public pruneStalePeers(): void {
    const now = Date.now();
    let changed = false;

    for (const [id, peer] of this.peers.entries()) {
      // Si el enlace BLE físico continúa conectado a nivel GATT, preservar el nodo
      const hwId = peer.hardwareId || id;
      if (peer.transport === 'ble' && bluetoothTransport.isDeviceConnected(hwId)) {
        peer.lastSeen = now;
        continue;
      }

      // Si el enlace WiFi Direct local continúa activo en el conjunto de pares, preservar el nodo
      if (peer.transport === 'wifi' && this.wifi?.onlinePeers.has(id)) {
        peer.lastSeen = now;
        continue;
      }

      const ttl = peer.transport === 'lora' ? 180_000 : (peer.transport === 'wifi' ? 30_000 : 45_000);
      const age = now - (peer.lastSeen || 0);

      if (age > ttl) {
        console.log(`[MeshRouter] ⏱️ Par inactivo purgado de la topología: ${peer.name || id} (${peer.transport}, edad ${Math.round(age / 1000)}s)`);
        this.peers.delete(id);
        this.activeGateways.delete(id);
        if (peer.canonicalId && peer.canonicalId !== id) {
          this.peers.delete(peer.canonicalId);
          this.activeGateways.delete(peer.canonicalId);
        }
        changed = true;
      }
    }

    if (changed) {
      this.notifyPeersChange();
    }
  }

  public updatePeer(
    id: string,
    transport: MeshTransport,
    rssi?: number,
    canonicalId?: string,
    name?: string,
    publicKey?: string,
    isGateway?: boolean,
    hasInternet?: boolean,
    kyberPublicKey?: string,
    x25519PublicKey?: string
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

    const hwId = (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(id.trim()))
      ? id.trim().toUpperCase()
      : (existing?.hardwareId || (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(cleanId) ? cleanId.toUpperCase() : undefined));

    const updated: MeshPeer = {
      id: resolvedCanonical,
      canonicalId: resolvedCanonical,
      hardwareId: hwId,
      name: bestName,
      publicKey: publicKey || existing?.publicKey,
      kyberPublicKey: kyberPublicKey || existing?.kyberPublicKey,
      x25519PublicKey: x25519PublicKey || existing?.x25519PublicKey,
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

    // Sync PQC key to cached contacts if present
    if (typeof window !== 'undefined' && kyberPublicKey) {
      try {
        const rawConts = localStorage.getItem('red_web_contacts');
        if (rawConts) {
          const conts = JSON.parse(rawConts);
          const cIdx = conts.findIndex((c: any) => {
            const cH = normalizeIdentity(c.identity_hash || '');
            return cH === resolvedCanonical || (resolvedCanonical.length >= 8 && cH.startsWith(resolvedCanonical.slice(0, 8)));
          });
          if (cIdx >= 0) {
            conts[cIdx].kyber_public_key = kyberPublicKey;
            if (x25519PublicKey) conts[cIdx].x25519_public_key = x25519PublicKey;
            localStorage.setItem('red_web_contacts', JSON.stringify(conts));
            window.dispatchEvent(new CustomEvent('red:contact_pqc_updated', {
              detail: {
                identity_hash: resolvedCanonical,
                kyber_public_key: kyberPublicKey,
                x25519_public_key: x25519PublicKey
              }
            }));
          }
        }
      } catch {}
    }

    // Track active gateways
    if (finalIsGateway || finalHasInternet) {
      this.activeGateways.set(resolvedCanonical, updated);
    } else {
      this.activeGateways.delete(resolvedCanonical);
    }
    const peerLqs = updated.rssi ? bluetoothTransport.getLinkQuality(resolvedCanonical) : 70;
    synapticMeshRouter.touchPeer(resolvedCanonical, peerLqs);
    this.notifyPeersChange();
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
      // Inferencia Activa de Friston (Predictive Cortex): Supresión de emisión si el movimiento es predecible
      try {
        const { PredictiveCortexEngine } = await import('../neuro/human/PredictiveCortexEngine');
        const decision = PredictiveCortexEngine.getInstance().evaluateLocalTransmission({
          lat,
          lon: lng,
          alt: altitude,
        });
        if (!decision.shouldTransmit) {
          // Ahorro del 100% de ancho de banda y radio silencio LPI
          return;
        }
      } catch {}

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

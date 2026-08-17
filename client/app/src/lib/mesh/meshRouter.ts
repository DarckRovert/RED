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
import { networkWatcher, NetworkState } from './networkWatcher';
import { dtnStorage } from './dtnStorage';
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
  private myIdentityHash: string = '';
  public wifi: WifiDirectTransport | null = null;
  public hasInternetAccess = false;

  /** Nonces of recently seen packets — prevents relay loops */
  private seenNonces: Map<string, number> = new Map(); // nonce → timestamp

  /** Known peers across all transports (keyed by canonical ID or hardware ID) */
  public peers: Map<string, MeshPeer> = new Map();

  /** Discovered active Gateway nodes with Internet uplink access */
  public activeGateways: Map<string, MeshPeer> = new Map();

  /** Maps raw hardware device IDs (BLE MAC, WebRTC client IDs) to 64-char canonical identity_hash */
  public deviceToCanonicalMap: Map<string, string> = new Map();

  /** Pending identity query promises keyed by hardware device ID or sender hash */
  private pendingIdentityQueries: Map<string, PendingIdentityQuery[]> = new Map();

  /** Listeners for packets addressed to THIS node */
  private localDeliveryHandlers: MeshMessageHandler[] = [];

  private initialized = false;
  private unsubscribeNetwork: (() => void) | null = null;

  // ─── Initialization ─────────────────────────────────────────────────────────

  init(myIdentityHash: string) {
    if (this.initialized) return;
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

    // Initialize Network Watcher for automatic transitions (WiFi <-> 4G/5G <-> Offline)
    networkWatcher.init();
    this.hasInternetAccess = networkWatcher.hasInternet;

    this.unsubscribeNetwork = networkWatcher.onChange((state: NetworkState) => {
      this.handleNetworkChange(state);
    });

    console.log('[MeshRouter] Initialized — identity:', myIdentityHash.slice(0, 12));
  }

  async start() {
    if (!this.wifi) return;

    // Connect to local WebRTC signaling & global relays
    try {
      await this.wifi.connectToLocalSignaling();
      console.log('[MeshRouter] WiFi signaling connected');
    } catch (e) {
      console.warn('[MeshRouter] No WiFi signaling available (ok if offline):', e);
    }

    // Schedule dedup cache purge every 5 minutes
    setInterval(() => this.purgeDedup(), 5 * 60 * 1000);

    // Retry persistent DTN pending queue every 8 seconds
    setInterval(() => this.flushPendingQueue(), 8000);

    // Initial DTN flush on boot
    setTimeout(() => this.flushPendingQueue(), 2000);
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
    const clean = id.trim();
    if (this.deviceToCanonicalMap.has(clean)) {
      return this.deviceToCanonicalMap.get(clean)!;
    }
    const peer = this.peers.get(clean);
    if (peer?.canonicalId && peer.canonicalId.length === 64) {
      return peer.canonicalId;
    }
    if (clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean)) {
      return clean.toLowerCase();
    }
    return clean;
  }

  /**
   * Finds a peer record by hardware ID, canonical ID, or reverse lookup.
   */
  getPeerByAnyId(id: string): MeshPeer | undefined {
    if (!id) return undefined;
    const clean = id.trim();
    if (this.peers.has(clean)) return this.peers.get(clean);
    const canonical = this.getCanonicalId(clean);
    if (canonical && this.peers.has(canonical)) return this.peers.get(canonical);
    for (const p of this.peers.values()) {
      if (p.id === clean || p.canonicalId === clean || p.canonicalId === canonical) return p;
    }
    return undefined;
  }

  /**
   * Binds a hardware device ID (e.g. BLE MAC) to a canonical 64-hex identity_hash.
   */
  bindDeviceToCanonical(deviceId: string, canonicalId: string, displayName?: string, publicKey?: string) {
    if (!deviceId || !canonicalId) return;
    const cleanDevice = deviceId.trim();
    const cleanCanonical = canonicalId.trim();

    this.deviceToCanonicalMap.set(cleanDevice, cleanCanonical);

    // Migrate any temporary peer record under deviceId to canonicalId
    const tempPeer = this.peers.get(cleanDevice);
    if (tempPeer && cleanDevice !== cleanCanonical) {
      this.peers.delete(cleanDevice);
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
        if (displayName) existing.name = displayName;
        if (publicKey) existing.publicKey = publicKey;
        this.peers.set(cleanCanonical, existing);
      }
    }

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

      if (typeof window !== 'undefined') {
        displayName = localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname') || 'Operador RED';
        pubKey = localStorage.getItem('red_public_key') || this.myIdentityHash;
        shortId = localStorage.getItem('red_short_id') || this.myIdentityHash.slice(0, 8);
      }

      const payloadObj = {
        type: 'IDENTITY_ANNOUNCE',
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
   * If no immediate route exists, the packet enters the persistent DTN queue.
   */
  async send(recipientHash: string, payload: Uint8Array): Promise<'sent' | 'queued' | 'failed'> {
    const canonicalRecipient = this.getCanonicalId(recipientHash);
    const packet = createPacket(this.myIdentityHash, canonicalRecipient, payload);
    return this.forwardPacket(packet, null);
  }

  /**
   * Broadcast a raw payload to ALL connected peers (mesh flood).
   */
  async broadcast(payload: Uint8Array, exceptPeer?: string): Promise<number> {
    let sent = 0;
    for (const [peerId, peer] of this.peers) {
      if (peerId === exceptPeer) continue;
      const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora') || 'ble', payload);
      if (ok) sent++;
    }
    return sent;
  }

  // ─── Receiving & Relaying ───────────────────────────────────────────────────

  private async handleRawPacket(raw: Uint8Array, fromTransportId?: string, transportType?: 'ble' | 'wifi' | 'lora') {
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

    try {
      const payloadStr = new TextDecoder().decode(packet.payload);

      // 1. DELIVERY_ACK Handling
      if (payloadStr.startsWith('{') && payloadStr.includes('DELIVERY_ACK')) {
        const parsed = JSON.parse(payloadStr);
        if (parsed.type === 'DELIVERY_ACK' && parsed.payload) {
          isDeliveryAck = true;
          ackNonce = parsed.payload.nonce;
          ackMessageId = parsed.payload.message_id;

          if (ackNonce) {
            dtnStorage.remove(ackNonce);
            console.log(`[MeshRouter] Received DELIVERY_ACK for nonce ${ackNonce.slice(0, 8)} — cleared from DTN storage`);
          }

          // Update local conversation store message status to 'Delivered'
          if (typeof window !== 'undefined' && (ackMessageId || ackNonce)) {
            try {
              const peerKey = packet.sender;
              const convKey = `red_web_messages_${peerKey}`;
              const rawMsgs = localStorage.getItem(convKey);
              if (rawMsgs) {
                const msgs = JSON.parse(rawMsgs);
                let updated = false;
                for (const m of msgs) {
                  if (m.id === ackMessageId || m.id === ackNonce || (m.status === 'Sent' && m.is_mine)) {
                    m.status = 'Delivered';
                    updated = true;
                  }
                }
                if (updated) {
                  localStorage.setItem(convKey, JSON.stringify(msgs));
                }
              }
            } catch {}
          }
          return;
        }
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

      // 3. Contact & Location Signals
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

    const isForMe =
      isHandshakeMsg ||
      isLocationMsg ||
      packet.recipient === this.myIdentityHash ||
      packet.recipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
      packet.recipient === '0000000000000000000000000000000000000000000000000000000000000000' ||
      (packet.recipient.length >= 4 && this.myIdentityHash.toLowerCase().includes(packet.recipient.toLowerCase())) ||
      (packet.recipient.length >= 4 && packet.recipient.toLowerCase().includes(this.myIdentityHash.substring(0, 8).toLowerCase()));

    if (isForMe) {
      // ── FINAL DELIVERY: packet is for us ──
      console.log(`[MeshRouter] Packet delivered locally from ${packet.sender.slice(0, 8)}`);
      this.deliverToRustNode(packet);
      this.localDeliveryHandlers.forEach(h => h(packet));

      // Emit DELIVERY_ACK to sender (unless broadcast packet)
      if (packet.sender && packet.sender !== this.myIdentityHash && packet.recipient !== 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') {
        this.sendDeliveryAck(packet.sender, packet.nonce).catch(() => {});
      }
    } else {
      // ── RELAY: packet is for someone else — forward it ──
      // If we are a Gateway with internet and the packet is addressed to a remote DID, uplink it!
      const forwarded = relay(packet);
      if (forwarded) {
        console.log(`[MeshRouter] Relaying packet → ${packet.recipient.slice(0, 8)} (TTL ${forwarded.ttl})`);
        const encoded = encode(forwarded);

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
    const peersToSend = Array.from(this.peers.entries())
      .filter(([id]) => id !== exceptPeer);

    let anySent = false;

    // 1. Direct local peers (BLE / WiFi LAN / LoRa)
    for (const [peerId, peer] of peersToSend) {
      const ok = await this.sendToPeer(peerId, (peer.transport as 'wifi' | 'ble' | 'lora') || 'ble', encoded);
      if (ok) anySent = true;
    }

    // 2. Direct Internet Uplink (if this node has active Internet)
    if (!anySent && this.hasInternetAccess && this.wifi && packet.recipient && packet.recipient !== 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') {
      const ok = await this.wifi.send(packet.recipient, encoded);
      if (ok) anySent = true;
    }

    // 3. Autonomous Mesh-to-Internet Gateway Delegation (Edge Bridge Routing)
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
      const hex = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join('');
      await RedAPI.injectMeshPayload(hex, true);
      return true;
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
    }
  }

  // ─── DTN Store-and-Forward Queue Flusher ──────────────────────────────────────

  public async flushPendingQueue() {
    const items = dtnStorage.getItemsToRetry();
    if (items.length === 0) return;

    let flushed = 0;
    for (const item of items) {
      const packet = dtnStorage.toMeshPacket(item);
      const result = await this.forwardPacket(packet, null);

      if (result === 'sent') {
        dtnStorage.markAttempt(item.id, true);
        flushed++;
      } else {
        dtnStorage.markAttempt(item.id, false);
      }
    }

    if (flushed > 0) {
      console.log(`[MeshRouter] ✅ Flushed and delivered ${flushed} DTN packets from persistent storage`);
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

  private updatePeer(
    id: string,
    transport: 'wifi' | 'ble' | 'lora',
    rssi?: number,
    canonicalId?: string,
    name?: string,
    publicKey?: string,
    isGateway?: boolean,
    hasInternet?: boolean
  ) {
    let resolvedCanonical = canonicalId || this.deviceToCanonicalMap.get(id);

    // If no explicit canonical ID, check if a peer with the same unique name already exists
    if (!resolvedCanonical && name && name !== 'Dispositivo RED' && !name.startsWith('Nodo ') && !name.startsWith('RED-')) {
      for (const [k, p] of this.peers.entries()) {
        if (p.name === name) {
          resolvedCanonical = k;
          this.deviceToCanonicalMap.set(id, k);
          break;
        }
      }
    }
    if (!resolvedCanonical) {
      resolvedCanonical = id;
    }

    const existing = this.peers.get(resolvedCanonical) || this.peers.get(id);

    const existingTransports = new Set<string>(existing?.transports || (existing?.transport ? [existing.transport] : []));
    existingTransports.add(transport);

    // Upgrade transport if better one found
    const priority: Record<string, number> = { wifi: 3, ble: 2, lora: 1 };
    const newPriority = priority[transport] || 0;
    const existingPriority = (existing && existing.transport) ? (priority[existing.transport] || 0) : 0;

    const finalIsGateway = isGateway !== undefined ? isGateway : (existing?.isGateway ?? false);
    const finalHasInternet = hasInternet !== undefined ? hasInternet : (existing?.hasInternet ?? false);

    const updated: MeshPeer = {
      id: resolvedCanonical,
      canonicalId: resolvedCanonical,
      name: name || existing?.name,
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

  private isDuplicate(nonce: string): boolean {
    return this.seenNonces.has(nonce);
  }

  private markSeen(nonce: string) {
    this.seenNonces.set(nonce, Date.now());
    if (this.seenNonces.size > MAX_DEDUP_CACHE) {
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

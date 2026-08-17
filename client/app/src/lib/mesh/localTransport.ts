/**
 * LocalTransport — Bridge between the Rust P2P node and the JavaScript mesh layer.
 *
 * This coordinator:
 * 1. Initializes all hardware transports (WiFi Direct, BLE)
 * 2. Feeds discovered peers into the MeshRouter
 * 3. Listens to the Rust node's SSE stream and re-radiates outgoing messages
 *    through the mesh when internet connectivity is absent
 * 4. Provides the public API used by the store (useRedStore)
 */

import { bluetoothTransport, RedDevice } from './bluetoothTransport';
import { WifiDirectTransport } from './wifiDirectTransport';
import { meshRouter, MeshPeer } from './meshRouter';
import { createPacket, encode } from './meshProtocol';

const RUST_NODE_URL = 'http://127.0.0.1:7333';

class LocalTransport {
  private myIdentityHash: string = '';
  private isStarted = false;

  /** Discovered BLE peers (from scanning) */
  public discoveredBluetoothPeers: RedDevice[] = [];

  // ─── Initialization ──────────────────────────────────────────────────────────

  /**
   * Initialize the mesh layer with our identity hash.
   * Call this once after the Rust node is ready and we have our identity.
   */
  async init(myIdentityHash: string) {
    if (this.isStarted) return;
    this.myIdentityHash = myIdentityHash;
    this.isStarted = true;

    // Initialize the central mesh router
    meshRouter.init(myIdentityHash);

    // Connect WiFi Direct signaling and start BLE scan loop
    await meshRouter.start();
    
    // Explicit runtime permissions requested before scanning!
    try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
            const { Geolocation } = await import('@capacitor/geolocation');
            await Geolocation.requestPermissions().catch(console.warn);
            
            const { BleClient } = await import('@capacitor-community/bluetooth-le');
            await BleClient.initialize(); // On Android 12+, this triggers the Nearby Devices permission prompt
        }
    } catch (e) {
        console.warn('[LocalTransport] Permission request failed:', e);
    }

    this.startBleScanLoop();

    // Hook WiFi peer discovery events into MeshRouter
    this.hookWifiPeerEvents();

    if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'meshPeerCounts', {
            get: () => this.peerCounts,
            configurable: true
        });
    }

    console.log('[LocalTransport] Mesh layer initialized for identity:', myIdentityHash.slice(0, 12));
  }

  private bleScanIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private bleScanIntervalMs: number = 6000;

  // ─── BLE ─────────────────────────────────────────────────────────────────────

  public setScanInterval(ms: number) {
    if (this.bleScanIntervalMs === ms && this.bleScanIntervalTimer) return;
    this.bleScanIntervalMs = ms;
    if (this.bleScanIntervalTimer) {
      clearInterval(this.bleScanIntervalTimer);
      this.bleScanIntervalTimer = null;
    }
    if (this.isStarted) {
      this.bleScanIntervalTimer = setInterval(() => this.performBleScan(), this.bleScanIntervalMs);
    }
  }

  private startBleScanLoop() {
    // Initial scan
    this.performBleScan();
    // Dynamic rescan based on power profile
    if (this.bleScanIntervalTimer) clearInterval(this.bleScanIntervalTimer);
    this.bleScanIntervalTimer = setInterval(() => this.performBleScan(), this.bleScanIntervalMs);
  }

  private async performBleScan() {
    this.discoveredBluetoothPeers = [];
    try {
      await bluetoothTransport.scan((device) => {
        const existing = this.discoveredBluetoothPeers.find(d => 
          d.id === device.id || 
          (device.name && device.name !== 'Dispositivo RED' && d.name === device.name)
        );
        if (existing) {
          existing.rssi = device.rssi;
          existing.id = device.id;
          meshRouter.addBlePeer(device.id, device.rssi, undefined, device.name);
        } else {
          this.discoveredBluetoothPeers.push(device);
          // Register newly found BLE device in the mesh router with its advertised name
          meshRouter.addBlePeer(device.id, device.rssi, undefined, device.name);
          console.log(`[LocalTransport] BLE peer discovered: ${device.name} (RSSI ${device.rssi})`);
        }
      }, 5000);
    } catch (e) {
      // BLE not available (e.g. web browser or permission denied) — non-fatal
      console.warn('[LocalTransport] BLE scan unavailable:', e);
    }
  }

  async connectBluetooth(deviceId: string) {
    await bluetoothTransport.connect(deviceId);
    meshRouter.addBlePeer(deviceId);
    // Send immediate identity announce to bind deviceId <-> canonical identity
    await meshRouter.sendIdentityAnnounce(deviceId, 'ble').catch(() => {});
  }

  // ─── WiFi Direct ─────────────────────────────────────────────────────────────

  private hookWifiPeerEvents() {
    // WifiDirectTransport exposes onlinePeers as a Set.
    // We poll it every 5s and register any new peers with the MeshRouter.
    setInterval(() => {
      const wifi = (meshRouter as any).wifi as WifiDirectTransport | null;
      if (!wifi) return;
      for (const peerId of wifi.onlinePeers) {
        meshRouter.addWifiPeer(peerId);
      }
    }, 5_000);
  }

  // ─── Unified Send ─────────────────────────────────────────────────────────────

  /**
   * Send a binary payload to a specific identity hash via mesh.
   * Multi-hop: if there's no direct path, peers will relay it through the network.
   */
  async sendToIdentity(recipientHash: string, payload: Uint8Array): Promise<'sent' | 'queued' | 'failed'> {
    return meshRouter.send(recipientHash, payload);
  }

  /**
   * Send raw payload to a specific peer by device ID (BLE or WiFi).
   * Used for legacy compatibility.
   */
  async send(peerId: string, payload: Uint8Array): Promise<'wifi' | 'bluetooth' | 'failed'> {
    const peer = meshRouter.peers.get(peerId);
    if (peer?.transport === 'wifi') {
      const wifi = (meshRouter as any).wifi as WifiDirectTransport | null;
      if (wifi) {
        const ok = await wifi.send(peerId, payload);
        if (ok) return 'wifi';
      }
    }
    const ok = await bluetoothTransport.send(peerId, payload);
    if (ok) return 'bluetooth';
    return 'failed';
  }

  // ─── Status Accessors ─────────────────────────────────────────────────────────

  /** All peers currently visible across all transports */
  get allPeers(): MeshPeer[] {
    return meshRouter.getPeerList();
  }

  /** Total connected peers */
  get totalPeerCount(): number {
    return meshRouter.peerCount;
  }

  /** Peers by transport type & gateway metrics */
  get peerCounts(): { wifi: number; ble: number; lora: number; gateways: number; pendingDtn: number; hasInternet: boolean; total: number } {
    return {
      wifi: meshRouter.wifiPeerCount,
      ble: meshRouter.blePeerCount,
      lora: meshRouter.loraPeerCount,
      gateways: meshRouter.gatewayCount,
      pendingDtn: meshRouter.pendingDtnCount,
      hasInternet: meshRouter.hasInternetAccess,
      total: meshRouter.peerCount,
    };
  }

  /**
   * AI Smart Routing: Calculates link quality score (0-100%) and optimal transport route.
   */
  calculateOptimalRoute(peerHash?: string): { optimalTransport: string; scorePct: number; recommendation: string } {
    const peers = this.allPeers;
    if (peers.length === 0) {
      if (meshRouter.hasInternetAccess) {
        return {
          optimalTransport: 'WAN Relay Global',
          scorePct: 95,
          recommendation: 'Nodo con salida a Internet activa. Enrutamiento directo vía WAN Relay & WebRTC STUN.'
        };
      }
      if (meshRouter.gatewayCount > 0) {
        return {
          optimalTransport: 'Pasarela Malla (Bridge)',
          scorePct: 85,
          recommendation: `Enrutamiento asistido a través de ${meshRouter.gatewayCount} nodo(s) Pasarela con salida a Internet.`
        };
      }
      return {
        optimalTransport: 'Store & Forward DTN',
        scorePct: 100,
        recommendation: 'Sin nodos en rango directo. Los mensajes se guardan en la cola persistente DTN.'
      };
    }

    const target = peerHash ? peers.find(p => p.id === peerHash) || peers[0] : peers[0];
    let score = 50;

    // Transport weight
    if (target.transport === 'wifi') score += 35;
    else if (target.transport === 'ble') score += 25;
    else score += 15;

    // RSSI signal weight (-50 dBm = excellent, -95 = weak)
    if (target.rssi != null) {
      const rssiScore = Math.max(0, Math.min(25, ((target.rssi + 100) / 50) * 25));
      score += rssiScore;
    } else {
      score += 15;
    }

    const finalScore = Math.min(100, Math.round(score));
    const trans = (target.transport || 'ble').toUpperCase();
    let rec = '';
    if (finalScore >= 80) rec = `Enrutamiento Directo Óptimo vía ${trans} (Calidad ${finalScore}%)`;
    else if (finalScore >= 50) rec = `Vía Estable. Transmitiendo por ${trans} (Calidad ${finalScore}%)`;
    else rec = `Señal débil (${target.rssi || -85} dBm). Se recomienda modo Eco-Mesh.`;

    return {
      optimalTransport: trans,
      scorePct: finalScore,
      recommendation: rec
    };
  }
}

export const localTransport = new LocalTransport();

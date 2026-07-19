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

    console.log('[LocalTransport] Mesh layer initialized for identity:', myIdentityHash.slice(0, 12));
  }

  // ─── BLE ─────────────────────────────────────────────────────────────────────

  private startBleScanLoop() {
    // Initial scan
    this.performBleScan();
    // Rescan every 15s — BLE devices come and go
    setInterval(() => this.performBleScan(), 15_000);
  }

  private async performBleScan() {
    this.discoveredBluetoothPeers = [];
    try {
      await bluetoothTransport.scan((device) => {
        if (!this.discoveredBluetoothPeers.find(d => d.id === device.id)) {
          this.discoveredBluetoothPeers.push(device);
          // Register newly found BLE device in the mesh router
          meshRouter.addBlePeer(device.id, device.rssi);
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
    // Legacy compatibility — try direct send via the peer's known transport
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

  /** Peers by transport type */
  get peerCounts(): { wifi: number; ble: number; lora: number; total: number } {
    return {
      wifi: meshRouter.wifiPeerCount,
      ble: meshRouter.blePeerCount,
      lora: meshRouter.loraPeerCount,
      total: meshRouter.peerCount,
    };
  }
}

export const localTransport = new LocalTransport();

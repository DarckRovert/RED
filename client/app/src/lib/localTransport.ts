/**
 * RED — Local Transport Abstraction Layer
 * Unified interface that combines Bluetooth and WiFi Direct transports,
 * automatically routing through the best available channel.
 *
 * Priority: WiFi Direct > Bluetooth > Mesh (store-and-forward)
 */

import { BluetoothTransport, BLEPeer, bluetoothTransport } from './bluetoothTransport';
import { WifiDirectTransport, WifiPeer } from './wifiDirectTransport';
import { meshProtocol, MeshMessage } from './meshProtocol';

export type TransportMode = 'bluetooth' | 'wifi' | 'mesh' | 'internet';

export interface LocalPeer {
    id: string;
    name: string;
    transport: TransportMode;
    rssi?: number;
    connected: boolean;
    lastSeen: number;
}

export interface EncryptedLocalMessage {
    /** Sender peer ID */
    from: string;
    /** Encrypted blob (RED crypto layer output) */
    payload: Uint8Array;
    /** Transport used */
    transport: TransportMode;
    /** Whether this is a delayed mesh delivery */
    meshDelivery?: boolean;
}

type LocalMessageCallback = (msg: EncryptedLocalMessage) => void;

export class LocalTransport {
    private localId: string;
    private ble: BluetoothTransport;
    private wifi: WifiDirectTransport;
    private listeners: LocalMessageCallback[] = [];
    private _mode: TransportMode = 'internet';

    constructor(localId: string) {
        this.localId = localId;
        this.ble = bluetoothTransport;
        this.wifi = new WifiDirectTransport(localId);
        this._wireCallbacks();
    }

    get mode(): TransportMode { return this._mode; }
    get bleSupported(): boolean { return this.ble.supported; }

    get localPeers(): LocalPeer[] {
        const peers: LocalPeer[] = [];

        (this.ble as BluetoothTransport).connectedPeers.forEach((p: BLEPeer) => peers.push({
            id: p.id,
            name: p.name,
            transport: 'bluetooth',
            rssi: p.rssi,
            connected: p.connected,
            lastSeen: p.lastSeen,
        }));

        (this.wifi as WifiDirectTransport).connectedPeers.forEach((p: WifiPeer) => peers.push({
            id: p.id,
            name: p.name,
            transport: 'wifi',
            connected: p.connected,
            lastSeen: p.lastSeen,
        }));

        return peers;
    }

    /**
     * Start WiFi LAN discovery. BLE requires explicit user scan gesture.
     */
    async startWifi(): Promise<void> {
        await this.wifi.start();
        this._mode = 'wifi';
    }

    stopWifi(): void {
        this.wifi.stop();
        if (this._mode === 'wifi') this._mode = 'internet';
    }

    /**
     * Scan for BLE devices (requires user gesture in browser).
     * Returns the connected peer or null.
     */
    async scanBluetooth(): Promise<LocalPeer | null> {
        const device = await this.ble.scan();
        if (!device) return null;
        const peer = await this.ble.connect(device);
        if (!peer) return null;
        this._mode = 'bluetooth';
        // Flush any stored messages for this peer
        await meshProtocol.flushTo(peer.id);
        return {
            id: peer.id,
            name: peer.name,
            transport: 'bluetooth',
            rssi: peer.rssi,
            connected: peer.connected,
            lastSeen: peer.lastSeen,
        };
    }

    /**
     * Send an encrypted payload to a peer with automatic transport selection.
     * Falls back to mesh store-and-forward if no direct channel is available.
     */
    async send(peerId: string, payload: Uint8Array): Promise<TransportMode | null> {
        // 1. Try WiFi Direct (fastest)
        const wifiPeers = this.wifi.connectedPeers;
        const wifiPeer = wifiPeers.find(p => p.id === peerId);
        if (wifiPeer) {
            const ok = await this.wifi.send(peerId, payload);
            if (ok) return 'wifi';
        }

        // 2. Try Bluetooth
        const blePeers = this.ble.connectedPeers;
        const blePeer = blePeers.find(p => p.id === peerId);
        if (blePeer) {
            const ok = await this.ble.send(blePeer.deviceId, payload);
            if (ok) return 'bluetooth';
        }

        // 3. Store for mesh relay
        meshProtocol.enqueue(peerId, this.localId, payload);
        return 'mesh';
    }

    /**
     * Handle an incoming mesh relay message from a neighbor peer.
     */
    async receiveMeshMessage(rawMsg: MeshMessage): Promise<void> {
        await meshProtocol.receive(this.localId, rawMsg);
    }

    onMessage(cb: LocalMessageCallback): () => void {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(l => l !== cb); };
    }

    // ── Private ──────────────────────────────────────────────

    private _wireCallbacks(): void {
        // BLE messages
        this.ble.onMessage((fromId, data) => {
            this._dispatch({ from: fromId, payload: data, transport: 'bluetooth' });
            // Flush any stored mesh messages for this peer now that we have a channel
            meshProtocol.flushTo(fromId);
        });

        // WiFi messages
        this.wifi.onMessage((fromId, data) => {
            this._dispatch({ from: fromId, payload: data, transport: 'wifi' });
            meshProtocol.flushTo(fromId);
        });

        // Mesh delivery to local user
        meshProtocol.onDeliver(async (msg) => {
            const payload = new Uint8Array(msg.payload);
            this._dispatch({ from: msg.from, payload, transport: 'mesh', meshDelivery: true });
            return true;
        });
    }

    private _dispatch(msg: EncryptedLocalMessage): void {
        this.listeners.forEach(cb => cb(msg));
    }
}

/** Singleton — initialize with the local DID once the store is ready */
let _instance: LocalTransport | null = null;

export function getLocalTransport(localId?: string): LocalTransport {
    if (!_instance) {
        if (!localId) throw new Error('LocalTransport: localId required for first init');
        _instance = new LocalTransport(localId);
    }
    return _instance;
}

export function resetLocalTransport(): void {
    _instance = null;
}

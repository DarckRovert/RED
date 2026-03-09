/**
 * RED — Bluetooth Low Energy Transport
 * Uses the Web Bluetooth API to discover and communicate with nearby RED devices.
 *
 * Architecture:
 *  - Custom GATT service with a single RX/TX characteristic pair
 *  - Messages are fragmented into 512-byte MTU chunks
 *  - All payloads are pre-encrypted by the RED crypto layer before sending
 */

// ── Minimal Web Bluetooth API type shims ──────────────────────────────────
// These are available natively in browsers but TypeScript's lib.dom may not
// include them. We declare only what we strictly need.
declare interface BluetoothRemoteGATTServer {
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}
declare interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}
declare interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly value: DataView | null;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}
declare interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string;
    readonly gatt?: BluetoothRemoteGATTServer;
}
declare interface BluetoothRequestDeviceFilter {
    namePrefix?: string;
    services?: string[];
}
declare interface Bluetooth {
    requestDevice(options: {
        filters?: BluetoothRequestDeviceFilter[];
        optionalServices?: string[];
    }): Promise<BluetoothDevice>;
}
// ─────────────────────────────────────────────────────────────────────────

export const RED_BLE_SERVICE_UUID = '00001818-0000-1000-8000-00805f9b34fb';
export const RED_BLE_TX_CHAR_UUID = '00002a4d-0000-1000-8000-00805f9b34fb'; // App → Remote
export const RED_BLE_RX_CHAR_UUID = '00002a6e-0000-1000-8000-00805f9b34fb'; // Remote → App
export const RED_BLE_NAME_PREFIX = 'RED-';
export const BLE_MTU = 512; // bytes per write

export interface BLEPeer {
    id: string;
    deviceId: string;
    name: string;
    rssi?: number;
    server?: BluetoothRemoteGATTServer;
    txChar?: BluetoothRemoteGATTCharacteristic;
    rxChar?: BluetoothRemoteGATTCharacteristic;
    connected: boolean;
    lastSeen: number;
}

type MessageCallback = (fromId: string, data: Uint8Array) => void;

/** Reassembly buffer for fragmented BLE messages */
interface FragmentBuffer {
    totalLen: number;
    received: number;
    chunks: Uint8Array[];
}

export class BluetoothTransport {
    private peers = new Map<string, BLEPeer>();
    private listeners: MessageCallback[] = [];
    private fragmentBuffers = new Map<string, FragmentBuffer>();
    private _supported: boolean;

    constructor() {
        this._supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }

    get supported(): boolean { return this._supported; }

    get connectedPeers(): BLEPeer[] {
        return Array.from(this.peers.values()).filter(p => p.connected);
    }

    /**
     * Scan for nearby RED devices (user gesture required for Bluetooth API).
     * Returns the selected device; call connect() to open GATT.
     */
    async scan(): Promise<BluetoothDevice | null> {
        if (!this._supported) throw new Error('Web Bluetooth API not available');

        const device = await (navigator as Navigator & { bluetooth: Bluetooth }).bluetooth.requestDevice({
            filters: [
                { namePrefix: RED_BLE_NAME_PREFIX },
                { services: [RED_BLE_SERVICE_UUID] },
            ],
            optionalServices: [RED_BLE_SERVICE_UUID],
        });

        return device;
    }

    /**
     * Connect to a previously scanned BluetoothDevice.
     */
    async connect(device: BluetoothDevice): Promise<BLEPeer | null> {
        if (!device.gatt) return null;

        try {
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(RED_BLE_SERVICE_UUID);

            const txChar = await service.getCharacteristic(RED_BLE_TX_CHAR_UUID);
            const rxChar = await service.getCharacteristic(RED_BLE_RX_CHAR_UUID);

            // Subscribe to incoming notifications
            await rxChar.startNotifications();
            rxChar.addEventListener('characteristicvaluechanged', (event) => {
                const char = event.target as BluetoothRemoteGATTCharacteristic;
                if (char.value) {
                    this._handleFragment(device.id, new Uint8Array(char.value.buffer));
                }
            });

            // Track disconnection
            device.addEventListener('gattserverdisconnected', () => {
                const peer = this.peers.get(device.id);
                if (peer) { peer.connected = false; peer.server = undefined; }
                console.log(`[BLE] Disconnected: ${device.name}`);
            });

            const peer: BLEPeer = {
                id: this._deviceIdToPeerId(device.id),
                deviceId: device.id,
                name: device.name ?? 'Unknown',
                server,
                txChar,
                rxChar,
                connected: true,
                lastSeen: Date.now(),
            };

            this.peers.set(device.id, peer);
            console.log(`[BLE] Connected: ${peer.name}`);
            return peer;
        } catch (err) {
            console.error('[BLE] Connect error:', err);
            return null;
        }
    }

    /**
     * Send an encrypted payload to a connected BLE peer.
     * Automatically fragments if payload exceeds MTU.
     */
    async send(deviceId: string, payload: Uint8Array): Promise<boolean> {
        const peer = this.peers.get(deviceId);
        if (!peer?.connected || !peer.txChar) return false;

        try {
            // Build framing: [4 bytes total length] + payload
            const totalLen = payload.length;
            const header = new Uint8Array(4);
            new DataView(header.buffer).setUint32(0, totalLen, false);
            const framed = new Uint8Array(4 + totalLen);
            framed.set(header, 0);
            framed.set(payload, 4);

            // Send in MTU chunks
            for (let offset = 0; offset < framed.length; offset += BLE_MTU) {
                const chunk = framed.slice(offset, offset + BLE_MTU);
                await peer.txChar.writeValueWithResponse(chunk);
                // Small yield between chunks to avoid congestion
                if (offset + BLE_MTU < framed.length) {
                    await new Promise(r => setTimeout(r, 20));
                }
            }

            peer.lastSeen = Date.now();
            return true;
        } catch (err) {
            console.error('[BLE] Send error:', err);
            peer.connected = false;
            return false;
        }
    }

    /**
     * Disconnect from a device.
     */
    disconnect(deviceId: string): void {
        const peer = this.peers.get(deviceId);
        if (peer?.server?.connected) {
            peer.server.disconnect();
        }
        this.peers.delete(deviceId);
    }

    /**
     * Register a callback for incoming messages.
     */
    onMessage(cb: MessageCallback): () => void {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(l => l !== cb); };
    }

    // ── Private ──────────────────────────────────────────────

    private _handleFragment(deviceId: string, chunk: Uint8Array): void {
        let buf = this.fragmentBuffers.get(deviceId);

        if (!buf) {
            // First fragment: read 4-byte header
            if (chunk.length < 4) return;
            const totalLen = new DataView(chunk.buffer).getUint32(0, false);
            buf = { totalLen, received: 0, chunks: [] };
            this.fragmentBuffers.set(deviceId, buf);
            chunk = chunk.slice(4); // strip header
        }

        buf.chunks.push(chunk);
        buf.received += chunk.length;

        if (buf.received >= buf.totalLen) {
            // Reassemble
            const full = new Uint8Array(buf.totalLen);
            let offset = 0;
            for (const c of buf.chunks) {
                full.set(c.slice(0, buf.totalLen - offset), offset);
                offset += c.length;
            }
            this.fragmentBuffers.delete(deviceId);

            const peerId = this._deviceIdToPeerId(deviceId);
            this.listeners.forEach(cb => cb(peerId, full));
        }
    }

    private _deviceIdToPeerId(deviceId: string): string {
        return `ble:${deviceId}`;
    }
}

export const bluetoothTransport = new BluetoothTransport();

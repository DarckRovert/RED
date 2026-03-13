/**
 * RED — Bluetooth Low Energy Transport (Capacitor Native)
 * Uses @capacitor-community/bluetooth-le to discover and communicate with nearby RED devices.
 *
 * Architecture:
 *  - Custom GATT service with a single RX/TX characteristic pair
 *  - Messages are fragmented into MTU chunks
 *  - All payloads are pre-encrypted by the RED crypto layer before sending
 */

import { BleClient, dataViewToNumbers, BleDevice } from '@capacitor-community/bluetooth-le';

export const RED_BLE_SERVICE_UUID = '00001818-0000-1000-8000-00805f9b34fb';
export const RED_BLE_TX_CHAR_UUID = '00002a4d-0000-1000-8000-00805f9b34fb'; // App → Remote
export const RED_BLE_RX_CHAR_UUID = '00002a6e-0000-1000-8000-00805f9b34fb'; // Remote → App
export const RED_BLE_NAME_PREFIX = 'RED-';
export const BLE_MTU = 510; // bytes per write (safely below 512 MTU)

export interface BLEPeer {
    id: string;
    deviceId: string;
    name: string;
    rssi?: number;
    connected: boolean;
    lastSeen: number;
}

type MessageCallback = (fromId: string, data: Uint8Array) => void;

interface FragmentBuffer {
    totalLen: number;
    received: number;
    chunks: Uint8Array[];
}

export class BluetoothTransport {
    private peers = new Map<string, BLEPeer>();
    private listeners: MessageCallback[] = [];
    private fragmentBuffers = new Map<string, FragmentBuffer>();
    private _supported: boolean = false;
    private _initialized: boolean = false;

    constructor() {
        // Init deferred
    }

    private async init() {
        if (this._initialized) return;
        try {
            await BleClient.initialize();
            this._supported = true;
            this._initialized = true;
            console.log('[BLE] Capacitor BLE initialized successfully.');
        } catch (err) {
            console.warn('[BLE] Capacitor BLE failed to init or running in browser:', err);
            this._supported = false;
        }
    }

    get supported(): boolean { return this._supported || true; }

    get connectedPeers(): BLEPeer[] {
        return Array.from(this.peers.values()).filter(p => p.connected);
    }

    /**
     * Scan for nearby RED devices using native BLE scan.
     */
    async scan(): Promise<BleDevice | null> {
        await this.init();
        if (!this._supported) throw new Error('Bluetooth LE no está soportado en este entorno');

        let discoveredDevice: BleDevice | null = null;
        try {
            console.log('[BLE] Starting scan for RED services...');
            discoveredDevice = await BleClient.requestDevice({
                services: [RED_BLE_SERVICE_UUID],
                optionalServices: [RED_BLE_SERVICE_UUID]
            });
            return discoveredDevice;
        } catch (err) {
            console.warn('[BLE] Scan error or user cancelled:', err);
            return null;
        }
    }

    /**
     * Connect to a discovered BleDevice natively.
     */
    async connect(device: BleDevice): Promise<BLEPeer | null> {
        await this.init();
        try {
            console.log(`[BLE] Connecting to ${device.deviceId}...`);
            await BleClient.connect(device.deviceId, (disconnectedId) => {
                console.log(`[BLE] Call disconnected natively: ${disconnectedId}`);
                const peer = this.peers.get(disconnectedId);
                if (peer) { peer.connected = false; }
            });

            console.log(`[BLE] Subscribing to RX characteristic...`);
            await BleClient.startNotifications(
                device.deviceId,
                RED_BLE_SERVICE_UUID,
                RED_BLE_RX_CHAR_UUID,
                (value) => {
                    const chunk = new Uint8Array(dataViewToNumbers(value));
                    this._handleFragment(device.deviceId, chunk);
                }
            );

            const peer: BLEPeer = {
                id: this._deviceIdToPeerId(device.deviceId),
                deviceId: device.deviceId,
                name: device.name ?? 'Unknown Mobile',
                connected: true,
                lastSeen: Date.now(),
            };

            this.peers.set(device.deviceId, peer);
            console.log(`[BLE] Success! Connected: ${peer.name}`);
            return peer;
        } catch (err) {
            console.error('[BLE] Native connect error:', err);
            return null;
        }
    }

    /**
     * Send encrypted data fragmented at MTU limits via GATT Writes.
     */
    async send(deviceId: string, payload: Uint8Array): Promise<boolean> {
        const peer = this.peers.get(deviceId);
        if (!peer?.connected) return false;

        try {
            // Header [4 bytes totalLen] + Payload
            const totalLen = payload.length;
            const header = new Uint8Array(4);
            new DataView(header.buffer).setUint32(0, totalLen, false);
            const framed = new Uint8Array(4 + totalLen);
            framed.set(header, 0);
            framed.set(payload, 4);

            for (let offset = 0; offset < framed.length; offset += BLE_MTU) {
                const slice = framed.slice(offset, offset + BLE_MTU);
                const dataView = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
                await BleClient.write(deviceId, RED_BLE_SERVICE_UUID, RED_BLE_TX_CHAR_UUID, dataView);
                
                if (offset + BLE_MTU < framed.length) {
                    await new Promise(r => setTimeout(r, 20)); // Keep stable Android buffer queue
                }
            }

            peer.lastSeen = Date.now();
            return true;
        } catch (err) {
            console.error('[BLE] Native send error:', err);
            peer.connected = false;
            return false;
        }
    }

    disconnect(deviceId: string): void {
        BleClient.disconnect(deviceId).catch(console.error);
        this.peers.delete(deviceId);
    }

    onMessage(cb: MessageCallback): () => void {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(l => l !== cb); };
    }

    // --- Private Fragment Reassembler ---
    private _handleFragment(deviceId: string, chunk: Uint8Array): void {
        let buf = this.fragmentBuffers.get(deviceId);

        if (!buf) {
            if (chunk.length < 4) return;
            const totalLen = new DataView(chunk.buffer).getUint32(0, false);
            buf = { totalLen, received: 0, chunks: [] };
            this.fragmentBuffers.set(deviceId, buf);
            chunk = chunk.slice(4);
        }

        buf.chunks.push(chunk);
        buf.received += chunk.length;

        if (buf.received >= buf.totalLen) {
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

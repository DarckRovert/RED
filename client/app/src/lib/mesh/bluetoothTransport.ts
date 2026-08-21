import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';

const RED_BLE_SERVICE = "00001818-0000-1000-8000-00805f9b34fb";
const RED_BLE_WRITE_CHAR = "00002a4d-0000-1000-8000-00805f9b34fb"; // Client writes here (matches native server txChar)
const RED_BLE_NOTIFY_CHAR = "00002a6e-0000-1000-8000-00805f9b34fb"; // Client subscribes here (matches native server rxChar)

export interface RedDevice {
    id: string;
    deviceId?: string;
    name: string;
    rssi: number;
}

export interface LinkQualityMetrics {
    deviceId: string;
    rssi: number;
    lqs: number; // 0 to 100%
    packetsSent: number;
    packetsAcked: number;
    lossRate: number;
    lastSeen: number;
}

class BluetoothTransport {
    private isInitialized = false;
    private messageListeners: ((msg: {from: string, payload: Uint8Array}) => void)[] = [];
    private connectedDevices: Set<string> = new Set();
    private incomingBuffer: Map<string, Uint8Array> = new Map();
    private linkMetrics: Map<string, LinkQualityMetrics> = new Map();
    private negotiatedMtu: Map<string, number> = new Map();

    /** Calculate Link Quality Score (LQS 0-100%) from RSSI and packet delivery */
    public calculateLqs(rssi: number, lossRate = 0): number {
        // RSSI range: -40 dBm (perfect) to -100 dBm (barely readable)
        const clampedRssi = Math.max(-100, Math.min(-40, rssi));
        const rssiScore = Math.round(((clampedRssi + 100) / 60) * 100);
        const lqs = Math.max(0, Math.min(100, Math.round(rssiScore * (1 - lossRate))));
        return lqs;
    }

    public isDeviceConnected(deviceId: string): boolean {
        return this.connectedDevices.has(deviceId);
    }

    public getLinkMetrics(deviceId: string): LinkQualityMetrics | undefined {
        return this.linkMetrics.get(deviceId);
    }

    public getLinkQuality(deviceId: string): number {
        const metrics = this.linkMetrics.get(deviceId);
        if (metrics) return metrics.lqs;
        return 70;
    }

    public getAllLinkMetrics(): LinkQualityMetrics[] {
        return Array.from(this.linkMetrics.values());
    }

    private recordRssi(deviceId: string, rssi: number) {
        const existing = this.linkMetrics.get(deviceId) || {
            deviceId,
            rssi,
            lqs: this.calculateLqs(rssi),
            packetsSent: 0,
            packetsAcked: 0,
            lossRate: 0,
            lastSeen: Date.now()
        };
        existing.rssi = rssi;
        existing.lastSeen = Date.now();
        existing.lqs = this.calculateLqs(rssi, existing.lossRate);
        this.linkMetrics.set(deviceId, existing);
    }

    async init() {
        if (this.isInitialized) return;
        try {
            const { registerPlugin } = await import('@capacitor/core');
            const RedNode = registerPlugin<any>('RedNode');
            const receiveBuffers = new Map<string, { buffer: Uint8Array; timer: any }>();
            RedNode.addListener('bleMessageReceived', (data: any) => {
                if (data && data.data) {
                    const chunk = new Uint8Array(data.data);
                    const fromDevice = data.device || 'ble_peer';

                    let entry = receiveBuffers.get(fromDevice);
                    if (!entry) {
                        entry = { buffer: new Uint8Array(0), timer: null };
                        receiveBuffers.set(fromDevice, entry);
                    }

                    if (entry.timer) clearTimeout(entry.timer);
                    const merged = new Uint8Array(entry.buffer.length + chunk.length);
                    merged.set(entry.buffer);
                    merged.set(chunk, entry.buffer.length);
                    entry.buffer = merged;

                    // 1. Direct check if complete RED packet is already assembled
                    if (entry.buffer.length >= 96) {
                        const view = new DataView(entry.buffer.buffer, entry.buffer.byteOffset, entry.buffer.byteLength);
                        if (view.getUint32(0, false) === 0x52454401) {
                            const expectedPayloadLen = view.getUint16(70, true);
                            const totalRequired = 96 + expectedPayloadLen;
                            if (expectedPayloadLen < 0xFFFF && entry.buffer.length >= totalRequired) {
                                const fullPacket = entry.buffer.slice(0, totalRequired);
                                entry.buffer = entry.buffer.slice(totalRequired);
                                this.messageListeners.forEach(cb => cb({ from: fromDevice, payload: fullPacket }));
                                return;
                            }
                        }
                    }

                    // 2. Debounced flush for non-standard payloads or final chunk
                    entry.timer = setTimeout(() => {
                        if (entry && entry.buffer.length > 0) {
                            const payload = entry.buffer;
                            entry.buffer = new Uint8Array(0);
                            this.messageListeners.forEach(cb => cb({ from: fromDevice, payload }));
                        }
                    }, 120);
                }
            });
        } catch (e) {
            console.warn('[BLE] Native listener attach failed:', e);
        }
        await BleClient.initialize();
        this.isInitialized = true;
    }

    private isScanning = false;

    async scan(onDeviceFound: (device: RedDevice) => void, timeoutMs: number = 4000) {
        if (this.isScanning) return;
        await this.init();
        try {
            this.isScanning = true;
            await BleClient.requestLEScan(
                // We scan all devices and check both the 'RED-' name prefix and the RED service UUID in advertisements.
                { allowDuplicates: false },
                (result) => {
                    const devName = result.device.name ?? result.localName ?? '';
                    const hasRedService = result.uuids?.some(
                        (uuid) => uuid.toLowerCase() === RED_BLE_SERVICE.toLowerCase()
                    );

                    if (devName.startsWith('RED-') || hasRedService) {
                        const rssi = result.rssi ?? -85;
                        this.recordRssi(result.device.deviceId, rssi);
                        onDeviceFound({
                            id: result.device.deviceId,
                            name: devName || 'Dispositivo RED',
                            rssi
                        });
                    }
                }
            );

            await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        } catch (e) {
            console.warn('[BLE] Scan error:', e);
        } finally {
            try {
                await BleClient.stopLEScan();
            } catch {}
            this.isScanning = false;
        }
    }

    async connect(deviceId: string) {
        await this.init();
        if (this.connectedDevices.has(deviceId)) return;

        try {
            await BleClient.connect(deviceId).catch(() => {});
            // Request adaptive MTU (512 bytes for maximum throughput)
            try {
                if (typeof (BleClient as any).requestMtu === 'function') {
                    await (BleClient as any).requestMtu(deviceId, 512);
                    this.negotiatedMtu.set(deviceId, 500);
                } else {
                    this.negotiatedMtu.set(deviceId, 480);
                }
            } catch {
                this.negotiatedMtu.set(deviceId, 240); // Safe fallback
            }

            await BleClient.startNotifications(deviceId, RED_BLE_SERVICE, RED_BLE_NOTIFY_CHAR, (value) => {
                this.handleIncomingChunk(deviceId, new Uint8Array(value.buffer));
            }).catch(() => {});
        } catch (e) {
            console.warn('[BLE] Direct GATT connect fallback:', e);
        }

        // Always register deviceId in connectedDevices so meshRouter can send packets
        this.connectedDevices.add(deviceId);
    }

    async disconnect(deviceId: string) {
        if (!this.connectedDevices.has(deviceId)) return;
        await BleClient.disconnect(deviceId);
        this.connectedDevices.delete(deviceId);
        this.negotiatedMtu.delete(deviceId);
    }

    async send(deviceId: string, payload: Uint8Array): Promise<boolean> {
        if (!this.connectedDevices.has(deviceId)) {
            await this.connect(deviceId);
        }

        const metrics = this.linkMetrics.get(deviceId) || {
            deviceId,
            rssi: -75,
            lqs: 70,
            packetsSent: 0,
            packetsAcked: 0,
            lossRate: 0,
            lastSeen: Date.now()
        };
        metrics.packetsSent += 1;

        try {
            // Adaptive MTU chunk size (240 to 500 bytes depending on negotiation)
            const CHUNK_SIZE = this.negotiatedMtu.get(deviceId) || 480;
            const totalLength = payload.length;

            // Simple protocol: [4 bytes total length] [chunk data]
            const header = new Uint8Array(4);
            header[0] = (totalLength >> 24) & 0xFF;
            header[1] = (totalLength >> 16) & 0xFF;
            header[2] = (totalLength >> 8) & 0xFF;
            header[3] = totalLength & 0xFF;

            // Send header with first chunk if possible
            let offset = 0;
            while (offset < totalLength) {
                const isFirst = offset === 0;
                const sliceLength = Math.min(CHUNK_SIZE - (isFirst ? 4 : 0), totalLength - offset);
                
                const chunk = new Uint8Array((isFirst ? 4 : 0) + sliceLength);
                if (isFirst) {
                    chunk.set(header, 0);
                    chunk.set(payload.slice(offset, offset + sliceLength), 4);
                } else {
                    chunk.set(payload.slice(offset, offset + sliceLength), 0);
                }

                const dataView = new DataView(chunk.buffer);
                await BleClient.write(deviceId, RED_BLE_SERVICE, RED_BLE_WRITE_CHAR, dataView)
                    .catch(() => BleClient.writeWithoutResponse(deviceId, RED_BLE_SERVICE, RED_BLE_WRITE_CHAR, dataView));
                offset += sliceLength;
                
                // Small delay to prevent GATT buffer overflow
                await new Promise(r => setTimeout(r, 16));
            }

            metrics.packetsAcked += 1;
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(deviceId, metrics);
            return true;
        } catch (e) {
            console.error("BLE Send failed:", e);
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(deviceId, metrics);
            return false;
        }
    }

    private incomingBufferTimers: Map<string, any> = new Map();

    onMessage(callback: (msg: {from: string, payload: Uint8Array}) => void) {
        this.messageListeners.push(callback);
    }

    private handleIncomingChunk(deviceId: string, chunk: Uint8Array) {
        // Reset 10s reassembly timer
        if (this.incomingBufferTimers.has(deviceId)) {
            clearTimeout(this.incomingBufferTimers.get(deviceId));
        }
        this.incomingBufferTimers.set(deviceId, setTimeout(() => {
            if (this.incomingBuffer.has(deviceId)) {
                console.warn(`[BluetoothTransport] Reassembly timeout for device ${deviceId} — clearing incomplete buffer`);
                this.incomingBuffer.delete(deviceId);
                this.incomingBufferTimers.delete(deviceId);
            }
        }, 10000));

        let buffer = this.incomingBuffer.get(deviceId);
        if (!buffer || buffer.length === 0) {
            if (chunk.length < 4) return;
            const totalLength = ((chunk[0] << 24) >>> 0) + (chunk[1] << 16) + (chunk[2] << 8) + chunk[3];
            if (totalLength <= 0 || totalLength > 10 * 1024 * 1024) return; // Sanity check: max 10MB
            buffer = new Uint8Array(totalLength);
            buffer.set(chunk.slice(4), 0);
            (buffer as any)._bytesWritten = chunk.length - 4;
            (buffer as any)._totalLength = totalLength;
            this.incomingBuffer.set(deviceId, buffer);
        } else {
            const written = (buffer as any)._bytesWritten || 0;
            const remaining = buffer.length - written;
            const toWrite = Math.min(chunk.length, remaining);
            buffer.set(chunk.slice(0, toWrite), written);
            (buffer as any)._bytesWritten = written + toWrite;
        }

        const currentWritten = (buffer as any)._bytesWritten;
        const targetLength = (buffer as any)._totalLength;

        if (currentWritten >= targetLength) {
            if (this.incomingBufferTimers.has(deviceId)) {
                clearTimeout(this.incomingBufferTimers.get(deviceId));
                this.incomingBufferTimers.delete(deviceId);
            }
            this.incomingBuffer.delete(deviceId);
            // Complete message received! Bubble it up!
            this.messageListeners.forEach(cb => cb({ from: deviceId, payload: buffer as Uint8Array }));
        }
    }
}

export const bluetoothTransport = new BluetoothTransport();

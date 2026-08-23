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

    private unsupportedDevices: Map<string, number> = new Map();

    async init() {
        if (this.isInitialized) return;
        try {
            const { registerPlugin } = await import('@capacitor/core');
            const RedNode = registerPlugin<any>('RedNode');
            
            RedNode.addListener('bleMessageReceived', (data: any) => {
                if (data && data.data) {
                    const chunk = new Uint8Array(data.data);
                    const fromDevice = data.device || 'ble_peer';
                    this.processIncomingChunk(fromDevice, chunk);
                }
            });

            // Ensure native GATT server and BLE advertising are active
            await RedNode.startBleServer().catch(() => {});
        } catch (e) {
            console.warn('[BLE] Native listener attach failed:', e);
        }
        try {
            await BleClient.initialize();
        } catch (e) {
            console.warn('[BLE] BleClient init warning:', e);
        }
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

                    if (devName.startsWith('RED-') || hasRedService || (result.serviceData && Object.keys(result.serviceData).some(k => k.includes('1818') || k.includes('5246')))) {
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

    private connectingSet: Set<string> = new Set();

    async connect(deviceId: string): Promise<boolean> {
        await this.init();
        if (this.connectedDevices.has(deviceId)) return true;
        if (this.connectingSet.has(deviceId)) {
            // Wait for existing connection attempt
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 100));
                if (this.connectedDevices.has(deviceId)) return true;
                if (!this.connectingSet.has(deviceId)) break;
            }
        }

        this.connectingSet.add(deviceId);
        try {
            await BleClient.connect(deviceId);
            this.connectedDevices.add(deviceId);

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

            try {
                await BleClient.startNotifications(deviceId, RED_BLE_SERVICE, RED_BLE_NOTIFY_CHAR, (value) => {
                    this.processIncomingChunk(deviceId, new Uint8Array(value.buffer));
                });
            } catch (notifErr) {
                console.warn('[BLE] startNotifications non-fatal:', notifErr);
            }

            console.log(`[BLE] Successfully connected GATT to ${deviceId.slice(0, 8)}`);
            return true;
        } catch (e) {
            console.warn(`[BLE] Direct GATT connect failed for ${deviceId.slice(0, 8)}:`, e);
            this.connectedDevices.delete(deviceId);
            return false;
        } finally {
            this.connectingSet.delete(deviceId);
        }
    }

    async disconnect(deviceId: string) {
        if (!this.connectedDevices.has(deviceId)) return;
        try {
            await BleClient.disconnect(deviceId);
        } catch {}
        this.connectedDevices.delete(deviceId);
        this.negotiatedMtu.delete(deviceId);
    }

    async send(deviceId: string, payload: Uint8Array): Promise<boolean> {
        const unsuppUntil = this.unsupportedDevices.get(deviceId);
        if (unsuppUntil && Date.now() < unsuppUntil) {
            return false;
        }

        let isConnected = this.connectedDevices.has(deviceId);
        if (!isConnected) {
            isConnected = await this.connect(deviceId);
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

        if (!isConnected) {
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(deviceId, metrics);
            return false;
        }

        try {
            const CHUNK_SIZE = this.negotiatedMtu.get(deviceId) || 128;
            const totalLength = payload.length;
            const header = new Uint8Array(4);
            header[0] = 0xAA;
            header[1] = 0x55;
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
                try {
                    await BleClient.write(deviceId, RED_BLE_SERVICE, RED_BLE_WRITE_CHAR, dataView);
                } catch {
                    await BleClient.writeWithoutResponse(deviceId, RED_BLE_SERVICE, RED_BLE_WRITE_CHAR, dataView);
                }
                offset += sliceLength;
                
                // Small delay to prevent GATT buffer overflow
                await new Promise(r => setTimeout(r, 16));
            }

            metrics.packetsAcked += 1;
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(deviceId, metrics);
            return true;
        } catch (e: any) {
            const errMsg = String(e?.message || e || '');
            if (errMsg.includes('Characteristic not found') || errMsg.includes('Service not found')) {
                this.unsupportedDevices.set(deviceId, Date.now() + 45000);
            }
            console.error("BLE Send failed:", e);
            this.connectedDevices.delete(deviceId);
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(deviceId, metrics);
            return false;
        }
    }

    private incomingBuffers: Map<string, { buffer: Uint8Array; expectedLen: number; timer: any }> = new Map();

    onMessage(callback: (msg: {from: string, payload: Uint8Array}) => void) {
        this.messageListeners.push(callback);
    }

    /**
     * Unified Frame Reassembler for both GATT Server and Client incoming packets
     */
    private processIncomingChunk(deviceId: string, chunk: Uint8Array) {
        if (!chunk || chunk.length === 0) return;

        let entry = this.incomingBuffers.get(deviceId);
        if (!entry) {
            entry = { buffer: new Uint8Array(0), expectedLen: 0, timer: null };
            this.incomingBuffers.set(deviceId, entry);
        }

        if (entry.timer) clearTimeout(entry.timer);

        // Reset buffer if not completed within 8s
        entry.timer = setTimeout(() => {
            if (entry && entry.buffer.length > 0) {
                console.warn(`[BluetoothTransport] Reassembly timeout for ${deviceId.slice(0, 8)} — clearing partial buffer (${entry.buffer.length} bytes)`);
                entry.buffer = new Uint8Array(0);
                entry.expectedLen = 0;
            }
        }, 8000);

        // Append incoming chunk
        const merged = new Uint8Array(entry.buffer.length + chunk.length);
        merged.set(entry.buffer, 0);
        merged.set(chunk, entry.buffer.length);
        entry.buffer = merged;

        // Process frames from accumulated buffer
        while (entry.buffer.length >= 4) {
            if (entry.expectedLen === 0) {
                // Check if buffer starts with 4-byte length prefix
                const totalLen = ((entry.buffer[0] << 24) >>> 0) + (entry.buffer[1] << 16) + (entry.buffer[2] << 8) + entry.buffer[3];
                const view = new DataView(entry.buffer.buffer, entry.buffer.byteOffset, entry.buffer.byteLength);

                // If magic starts at offset 0 (raw RED packet without 4-byte prefix)
                if (view.getUint32(0, false) === 0x52454401) {
                    if (entry.buffer.length >= 96) {
                        const payloadLen = view.getUint16(70, true);
                        entry.expectedLen = 96 + payloadLen;
                    } else {
                        break; // Wait for full 96-byte header
                    }
                } else if (totalLen > 0 && totalLen <= 10 * 1024 * 1024) {
                    // Standard 4-byte prefixed packet
                    entry.expectedLen = totalLen;
                } else {
                    // Check if magic starts at offset 4
                    if (entry.buffer.length >= 8 && view.getUint32(4, false) === 0x52454401) {
                        if (entry.buffer.length >= 100) {
                            const payloadLen = view.getUint16(74, true);
                            entry.expectedLen = 96 + payloadLen;
                        } else {
                            break;
                        }
                    } else {
                        // Resync buffer: scan for magic 0x52454401
                        let syncIdx = -1;
                        for (let i = 1; i < entry.buffer.length - 3; i++) {
                            if (view.getUint32(i, false) === 0x52454401) {
                                syncIdx = i;
                                break;
                            }
                        }
                        if (syncIdx > 0) {
                            entry.buffer = entry.buffer.slice(syncIdx);
                            continue;
                        } else {
                            break;
                        }
                    }
                }
            }

            const view = new DataView(entry.buffer.buffer, entry.buffer.byteOffset, entry.buffer.byteLength);
            const startsWithMagic = view.getUint32(0, false) === 0x52454401;
            const hasHeaderPrefix = !startsWithMagic && entry.buffer.length >= 4;
            const requiredBytes = (hasHeaderPrefix ? 4 : 0) + entry.expectedLen;

            if (entry.buffer.length >= requiredBytes && entry.expectedLen > 0) {
                const packetSlice = hasHeaderPrefix
                    ? entry.buffer.slice(4, 4 + entry.expectedLen)
                    : entry.buffer.slice(0, entry.expectedLen);

                entry.buffer = entry.buffer.slice(requiredBytes);
                entry.expectedLen = 0;

                // Emit assembled packet
                console.log(`[BluetoothTransport] ✅ Assembled packet from ${deviceId.slice(0, 8)} (${packetSlice.length} bytes)`);
                this.messageListeners.forEach(cb => {
                    try { cb({ from: deviceId, payload: packetSlice }); } catch (err) { console.error('[BluetoothTransport] Listener error:', err); }
                });
            } else {
                break; // Incomplete, wait for more chunks
            }
        }
    }
}

export const bluetoothTransport = new BluetoothTransport();

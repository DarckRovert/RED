import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';

const RED_BLE_SERVICE = "00001818-0000-1000-8000-00805f9b34fb";
const RED_BLE_WRITE_CHAR = "00002a4d-0000-1000-8000-00805f9b34fb"; // Client writes here (matches native server txChar)
const RED_BLE_NOTIFY_CHAR = "00002a6e-0000-1000-8000-00805f9b34fb"; // Client subscribes here (matches native server rxChar)

export interface RedDevice {
    id: string;
    name: string;
    rssi: number;
}

class BluetoothTransport {
    private isInitialized = false;
    private messageListeners: ((msg: {from: string, payload: Uint8Array}) => void)[] = [];
    private connectedDevices: Set<string> = new Set();
    private incomingBuffer: Map<string, Uint8Array> = new Map();

    async init() {
        if (this.isInitialized) return;
        try {
            const { registerPlugin } = await import('@capacitor/core');
            const RedNode = registerPlugin<any>('RedNode');
            RedNode.addListener('bleMessageReceived', (data: any) => {
                if (data && data.data) {
                    const bytes = new Uint8Array(data.data);
                    const fromDevice = data.device || 'ble_peer';
                    this.messageListeners.forEach(cb => cb({ from: fromDevice, payload: bytes }));
                }
            });
        } catch (e) {
            console.warn('[BLE] Native listener attach failed:', e);
        }
        await BleClient.initialize();
        this.isInitialized = true;
    }

    async scan(onDeviceFound: (device: RedDevice) => void, timeoutMs: number = 10000) {
        await this.init();
        await BleClient.requestLEScan(
            // We scan all devices and check both the 'RED-' name prefix and the RED service UUID in advertisements.
            { allowDuplicates: false },
            (result) => {
                const devName = result.device.name ?? result.localName ?? '';
                const hasRedService = result.uuids?.some(
                    (uuid) => uuid.toLowerCase() === RED_BLE_SERVICE.toLowerCase()
                );

                if (devName.startsWith('RED-') || hasRedService) {
                    onDeviceFound({
                        id: result.device.deviceId,
                        name: devName || 'Dispositivo RED',
                        rssi: result.rssi ?? -100
                    });
                }
            }
        );
        
        setTimeout(async () => {
            await BleClient.stopLEScan();
        }, timeoutMs);
    }

    async connect(deviceId: string) {
        await this.init();
        if (this.connectedDevices.has(deviceId)) return;

        try {
            await BleClient.connect(deviceId).catch(() => {});
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
    }

    async send(deviceId: string, payload: Uint8Array): Promise<boolean> {
        if (!this.connectedDevices.has(deviceId)) {
            await this.connect(deviceId);
        }

        try {
            // BLE Payload fragmentation (512 bytes MTU assumed, sending 500 byte chunks safely)
            const CHUNK_SIZE = 500;
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
                await new Promise(r => setTimeout(r, 20));
            }
            return true;
        } catch (e) {
            console.error("BLE Send failed:", e);
            return false;
        }
    }

    onMessage(callback: (msg: {from: string, payload: Uint8Array}) => void) {
        this.messageListeners.push(callback);
    }

    private handleIncomingChunk(deviceId: string, chunk: Uint8Array) {
        // Very basic reassembly buffer
        let buffer = this.incomingBuffer.get(deviceId);
        // If it's the start of a new message (we assume header is always at start)
        // In a production environment, you'd use a more robust framing protocol instead of this naïve concat
        if (!buffer || buffer.length === 0) {
            if (chunk.length < 4) return;
            const totalLength = ((chunk[0] << 24) >>> 0) + (chunk[1] << 16) + (chunk[2] << 8) + chunk[3];
            buffer = new Uint8Array(totalLength);
            buffer.set(chunk.slice(4), 0);
            (buffer as any)._bytesWritten = chunk.length - 4;
            (buffer as any)._totalLength = totalLength;
            this.incomingBuffer.set(deviceId, buffer);
        } else {
            const written = (buffer as any)._bytesWritten;
            buffer.set(chunk, written);
            (buffer as any)._bytesWritten += chunk.length;
        }

        const currentWritten = (buffer as any)._bytesWritten;
        const targetLength = (buffer as any)._totalLength;

        if (currentWritten >= targetLength) {
            this.incomingBuffer.delete(deviceId);
            // Complete message received! Bubble it up!
            this.messageListeners.forEach(cb => cb({ from: deviceId, payload: buffer as Uint8Array }));
        }
    }
}

export const bluetoothTransport = new BluetoothTransport();

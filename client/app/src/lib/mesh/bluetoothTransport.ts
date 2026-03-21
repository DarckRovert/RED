import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';

const RED_BLE_SERVICE = "00001818-0000-1000-8000-00805f9b34fb";
const RED_BLE_RX_CHAR = "00002a6e-0000-1000-8000-00805f9b34fb"; // Escribimos aquí para que el servidor Remoto reciba
const RED_BLE_TX_CHAR = "00002a4d-0000-1000-8000-00805f9b34fb"; // El servidor Remoto escribe aquí para notificarnos

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
        await BleClient.initialize();
        this.isInitialized = true;
    }

    async scan(onDeviceFound: (device: RedDevice) => void, timeoutMs: number = 10000) {
        await this.init();
        await BleClient.requestLEScan(
            { services: [RED_BLE_SERVICE] },
            (result) => {
                onDeviceFound({
                    id: result.device.deviceId,
                    name: result.device.name ?? "RED Node",
                    rssi: result.rssi ?? -100
                });
            }
        );
        
        setTimeout(async () => {
            await BleClient.stopLEScan();
        }, timeoutMs);
    }

    async connect(deviceId: string) {
        await this.init();
        if (this.connectedDevices.has(deviceId)) return;

        await BleClient.connect(deviceId);
        
        // Notify us when the remote device (Java GATT server) writes to TX
        await BleClient.startNotifications(deviceId, RED_BLE_SERVICE, RED_BLE_TX_CHAR, (value) => {
            this.handleIncomingChunk(deviceId, new Uint8Array(value.buffer));
        });

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

                await BleClient.write(deviceId, RED_BLE_SERVICE, RED_BLE_RX_CHAR, new DataView(chunk.buffer));
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
            const totalLength = (chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3];
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

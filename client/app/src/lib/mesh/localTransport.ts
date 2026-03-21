import { bluetoothTransport, RedDevice } from './bluetoothTransport';
import { WifiDirectTransport } from './wifiDirectTransport';

class LocalTransport {
    private wifi: WifiDirectTransport | null = null;
    private myId: string = "";
    private isScanning = false;
    private activeRustInjectListeners = false;

    public discoveredBluetoothPeers: RedDevice[] = [];
    public onlineWifiPeers: string[] = [];

    init(myId: string) {
        this.myId = myId;
        this.wifi = new WifiDirectTransport(myId);
        
        // Listen to native hardware messages and push them directly to Rust Node's Mesh API
        this.setupRustInjectors();
    }

    private setupRustInjectors() {
        if (this.activeRustInjectListeners) return;
        
        const rpcCallback = async (msg: {from: string, payload: Uint8Array}) => {
            // Convert binary into HEX to pass via REST endpoint HTTP to Rust node
            const payload_hex = Array.from(msg.payload).map(b => b.toString(16).padStart(2, '0')).join('');
            try {
                await fetch('http://127.0.0.1:4555/api/mesh/receive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payload_hex, from_device: msg.from })
                });
            } catch (e) {
                console.error("[Mesh] Failed to inject raw payload to Rust:", e);
            }
        };

        bluetoothTransport.onMessage(rpcCallback);
        if (this.wifi) this.wifi.onMessage(rpcCallback);

        this.activeRustInjectListeners = true;
    }

    async startBackgroundSensing(updateUI?: () => void) {
        // 1. Hook up LAN WebRTC
        if (this.wifi) {
            await this.wifi.connectToLocalSignaling().catch(e => console.warn("No LAN signaling available", e));
        }

        // 2. Scan BLE forever (in intervals)
        if (!this.isScanning) {
            this.isScanning = true;
            this.performBleScan(updateUI);
            setInterval(() => this.performBleScan(updateUI), 15000); // Rescan every 15s
        }
    }

    private async performBleScan(updateUI?: () => void) {
        this.discoveredBluetoothPeers = [];
        try {
            await bluetoothTransport.scan((device) => {
                if (!this.discoveredBluetoothPeers.find(d => d.id === device.id)) {
                    this.discoveredBluetoothPeers.push(device);
                    if (updateUI) updateUI();
                }
            }, 5000);
        } catch (e) {
            console.warn("BLE Scan unavailable", e);
        }
    }

    async connectBluetooth(deviceId: string) {
        await bluetoothTransport.connect(deviceId);
    }

    /**
     * Sends a raw cryptographic byte payload across the fastest available offline conduit.
     */
    async send(peerId: string, payload: Uint8Array): Promise<'wifi' | 'bluetooth' | 'failed'> {
        // Priority 1: High Baud-rate WiFi Direct DataChannel
        if (this.wifi && this.wifi.onlinePeers.has(peerId)) {
            const success = await this.wifi.send(peerId, payload);
            if (success) return 'wifi';
        }

        // Priority 2: Bluetooth LE GATT connection
        // (Assuming the caller passed the deviceId as the peerId if they discovered them via BLE)
        const successBle = await bluetoothTransport.send(peerId, payload);
        if (successBle) return 'bluetooth';

        return 'failed';
    }
}

export const localTransport = new LocalTransport();

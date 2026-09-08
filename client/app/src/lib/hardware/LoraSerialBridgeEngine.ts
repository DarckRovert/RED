/**
 * LoraSerialBridgeEngine.ts — RED Sovereign Mesh OS (v64.0.0)
 *
 * Driver de transporte físico serie y transceptor LoRa de largo alcance (15–25 km).
 * Compatible con chips Semtech SX1262 / SX1276 / SX1278 (Heltec v3, LilyGO T-Beam, RAK4631).
 * Soporta transporte dual:
 * 1. WebUSB / Web Serial API (USB-OTG en Android / PC)
 * 2. Bluetooth LE Nordic UART Service (NUS)
 *
 * Implementa encuadre COBS (Consistent Overhead Byte Stuffing) y suma de verificación CRC-32.
 */

export interface LoraConfig {
    frequencyMhz: number;       // 915.0, 868.0, 433.0
    txPowerDbm: number;         // 2 a 22 dBm
    spreadingFactor: number;    // SF7 a SF12
    bandwidthKhz: number;       // 125, 250, 500 kHz
    codingRate: string;         // '4/5', '4/6', '4/7', '4/8'
    preambleLength: number;     // 8 a 16
    syncWord: number;           // 0x12 (Privada / RED) o 0x34 (Pública)
}

export interface LoraTelemetry {
    connected: boolean;
    transportType: 'USB_SERIAL' | 'BLE_NUS' | 'NONE';
    packetsSent: number;
    packetsReceived: number;
    bytesSent: number;
    bytesReceived: number;
    lastRssiDbm: number | null;
    lastSnrDb: number | null;
    lastPacketTimestamp: number | null;
}

export type LoraPacketCallback = (packet: Uint8Array, rssi?: number, snr?: number) => void;

export class LoraSerialBridgeEngine {
    private static instance: LoraSerialBridgeEngine;

    private config: LoraConfig = {
        frequencyMhz: 915.0,
        txPowerDbm: 20,
        spreadingFactor: 9,
        bandwidthKhz: 250,
        codingRate: '4/7',
        preambleLength: 8,
        syncWord: 0x12, // RED Sovereign Sync Word
    };

    private telemetry: LoraTelemetry = {
        connected: false,
        transportType: 'NONE',
        packetsSent: 0,
        packetsReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        lastRssiDbm: null,
        lastSnrDb: null,
        lastPacketTimestamp: null,
    };

    private rxCallbacks: Set<LoraPacketCallback> = new Set();
    private rxBuffer: number[] = [];

    private serialPort: any = null;
    private serialReader: any = null;
    private serialWriter: any = null;

    private bleDevice: any = null;
    private bleServer: any = null;
    private bleCharacteristicTx: any = null;
    private bleCharacteristicRx: any = null;

    public static readonly NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    public static readonly NORDIC_UART_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
    public static readonly NORDIC_UART_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

    private constructor() {}

    public static getInstance(): LoraSerialBridgeEngine {
        if (!LoraSerialBridgeEngine.instance) {
            LoraSerialBridgeEngine.instance = new LoraSerialBridgeEngine();
        }
        return LoraSerialBridgeEngine.instance;
    }

    // ─── COBS (Consistent Overhead Byte Stuffing) ───────────────────────────────

    public static encodeCOBS(data: Uint8Array): Uint8Array {
        if (!data || !(data instanceof Uint8Array) || data.length === 0) {
            return new Uint8Array([0x01, 0x00]);
        }
        const dest: number[] = [];
        let codeIndex = 0;
        let code = 1;
        dest.push(0); // placeholder

        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            if (byte === 0) {
                dest[codeIndex] = code;
                codeIndex = dest.length;
                dest.push(0);
                code = 1;
            } else {
                dest.push(byte);
                code++;
                if (code === 0xFF) {
                    dest[codeIndex] = code;
                    codeIndex = dest.length;
                    dest.push(0);
                    code = 1;
                }
            }
        }
        dest[codeIndex] = code;
        dest.push(0x00); // Delimitador de fin de paquete
        return new Uint8Array(dest);
    }

    public static decodeCOBS(encoded: Uint8Array): Uint8Array {
        if (!encoded || !(encoded instanceof Uint8Array) || encoded.length === 0) {
            return new Uint8Array(0);
        }
        // Remover delimitador final si existe
        let len = encoded.length;
        if (len > 0 && encoded[len - 1] === 0x00) {
            len--;
        }

        const dest: number[] = [];
        let srcIdx = 0;

        while (srcIdx < len) {
            const code = encoded[srcIdx++];
            if (code === 0) break;

            for (let i = 1; i < code && srcIdx < len; i++) {
                dest.push(encoded[srcIdx++]);
            }

            if (code < 0xFF && srcIdx < len) {
                dest.push(0);
            }
        }

        return new Uint8Array(dest);
    }

    // ─── Checksum CRC-32 IEEE 802.3 ─────────────────────────────────────────────

    public static calculateCRC32(data: Uint8Array): number {
        if (!data || !(data instanceof Uint8Array)) return 0;
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
            }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // ─── Empaquetado & Desempaquetado de Tramas LoRa RED ──────────────────────────

    public static framePacket(payload: Uint8Array): Uint8Array {
        if (!payload || !(payload instanceof Uint8Array)) return new Uint8Array(0);
        // [Payload (N bytes)] + [CRC-32 (4 bytes, Big Endian)]
        const crc = this.calculateCRC32(payload);
        const withCrc = new Uint8Array(payload.length + 4);
        withCrc.set(payload, 0);
        withCrc[payload.length]     = (crc >>> 24) & 0xFF;
        withCrc[payload.length + 1] = (crc >>> 16) & 0xFF;
        withCrc[payload.length + 2] = (crc >>> 8)  & 0xFF;
        withCrc[payload.length + 3] = (crc)        & 0xFF;

        return this.encodeCOBS(withCrc);
    }

    public static unframePacket(framed: Uint8Array): { valid: boolean; payload?: Uint8Array } {
        if (!framed || !(framed instanceof Uint8Array) || framed.length < 5) return { valid: false };
        try {
            const decoded = this.decodeCOBS(framed);
            if (decoded.length < 4) return { valid: false };

            const payloadLen = decoded.length - 4;
            const payload = decoded.slice(0, payloadLen);
            const expectedCrc = (
                (decoded[payloadLen] << 24) |
                (decoded[payloadLen + 1] << 16) |
                (decoded[payloadLen + 2] << 8) |
                (decoded[payloadLen + 3])
            ) >>> 0;

            const computedCrc = this.calculateCRC32(payload);
            if (computedCrc !== expectedCrc) {
                return { valid: false };
            }

            return { valid: true, payload };
        } catch {
            return { valid: false };
        }
    }

    // ─── Conexión Web Serial / USB-OTG ──────────────────────────────────────────

    public async connectWebSerial(baudRate = 115200): Promise<boolean> {
        if (typeof navigator === 'undefined' || !('serial' in navigator)) {
            console.warn('[LoRa] Web Serial no soportado en este entorno');
            return false;
        }

        try {
            const serial = (navigator as any).serial;
            this.serialPort = await serial.requestPort();
            await this.serialPort.open({ baudRate });

            this.telemetry.connected = true;
            this.telemetry.transportType = 'USB_SERIAL';

            this.startSerialReader();
            console.log(`[LoRa] Conectado a transceptor serie USB @ ${baudRate} bps`);
            return true;
        } catch (e) {
            console.error('[LoRa] Error al abrir puerto serie:', e);
            this.telemetry.connected = false;
            return false;
        }
    }

    private async startSerialReader() {
        if (!this.serialPort || !this.serialPort.readable) return;

        try {
            this.serialReader = this.serialPort.readable.getReader();
            while (this.telemetry.connected) {
                const { value, done } = await this.serialReader.read();
                if (done) break;
                if (value) {
                    this.feedRawBytes(new Uint8Array(value));
                }
            }
        } catch (e) {
            console.warn('[LoRa] Lector serie finalizado:', e);
        } finally {
            if (this.serialReader) {
                this.serialReader.releaseLock();
                this.serialReader = null;
            }
        }
    }

    // ─── Conexión Web Bluetooth LE / Nordic UART Service (NUS) ──────────────────

    public async connectBluetoothLE(): Promise<boolean> {
        if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
            console.warn('[LoRa] Web Bluetooth no soportado en este entorno');
            return false;
        }

        try {
            const bluetooth = (navigator as any).bluetooth;
            this.bleDevice = await bluetooth.requestDevice({
                filters: [
                    { services: [LoraSerialBridgeEngine.NORDIC_UART_SERVICE] },
                    { namePrefix: 'Meshtastic' },
                    { namePrefix: 'Heltec' },
                    { namePrefix: 'T-Beam' },
                    { namePrefix: 'RAK' },
                    { namePrefix: 'RED' }
                ],
                optionalServices: [LoraSerialBridgeEngine.NORDIC_UART_SERVICE]
            });

            if (!this.bleDevice || !this.bleDevice.gatt) {
                return false;
            }

            this.bleDevice.addEventListener('gattserverdisconnected', () => {
                console.warn('[LoRa] Dispositivo BLE desconectado');
                this.disconnect();
            });

            this.bleServer = await this.bleDevice.gatt.connect();
            const service = await this.bleServer.getPrimaryService(LoraSerialBridgeEngine.NORDIC_UART_SERVICE);

            this.bleCharacteristicRx = await service.getCharacteristic(LoraSerialBridgeEngine.NORDIC_UART_RX);
            this.bleCharacteristicTx = await service.getCharacteristic(LoraSerialBridgeEngine.NORDIC_UART_TX);

            await this.bleCharacteristicTx.startNotifications();
            this.bleCharacteristicTx.addEventListener('characteristicvaluechanged', (event: any) => {
                const value = event.target.value;
                if (value) {
                    this.feedRawBytes(new Uint8Array(value.buffer));
                }
            });

            this.telemetry.connected = true;
            this.telemetry.transportType = 'BLE_NUS';
            console.log(`[LoRa] Conectado a transceptor LoRa inalámbrico BLE (${this.bleDevice.name || 'NUS Device'})`);
            return true;
        } catch (e) {
            console.error('[LoRa] Error al conectar Bluetooth LE:', e);
            this.telemetry.connected = false;
            return false;
        }
    }

    public feedRawBytes(bytes: Uint8Array, rssi?: number, snr?: number) {
        if (!bytes || !(bytes instanceof Uint8Array)) return;
        this.telemetry.bytesReceived += bytes.length;
        if (rssi !== undefined && typeof rssi === 'number' && isFinite(rssi)) {
            this.telemetry.lastRssiDbm = rssi;
        }
        if (snr !== undefined && typeof snr === 'number' && isFinite(snr)) {
            this.telemetry.lastSnrDb = snr;
        }

        for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            if (b === 0x00) {
                if (this.rxBuffer.length > 0) {
                    const framed = new Uint8Array(this.rxBuffer);
                    this.rxBuffer = [];
                    const result = LoraSerialBridgeEngine.unframePacket(framed);
                    if (result.valid && result.payload) {
                        this.telemetry.packetsReceived++;
                        this.telemetry.lastPacketTimestamp = Date.now();
                        for (const cb of this.rxCallbacks) {
                            cb(result.payload, this.telemetry.lastRssiDbm || undefined, this.telemetry.lastSnrDb || undefined);
                        }
                    }
                }
            } else {
                this.rxBuffer.push(b);
                if (this.rxBuffer.length > 2048) {
                    // Buffer overflow protection
                    this.rxBuffer = [];
                }
            }
        }
    }

    // ─── Transmisión de Paquetes ────────────────────────────────────────────────

    public async sendPacket(payload: Uint8Array): Promise<boolean> {
        const framed = LoraSerialBridgeEngine.framePacket(payload);

        if (this.telemetry.transportType === 'BLE_NUS' && this.bleCharacteristicRx) {
            try {
                // Fragmentar en bloques de MTU BLE (128 bytes) para compatibilidad universal
                const chunkSize = 128;
                for (let i = 0; i < framed.length; i += chunkSize) {
                    const chunk = framed.slice(i, i + chunkSize);
                    if (this.bleCharacteristicRx.writeValueWithoutResponse) {
                        await this.bleCharacteristicRx.writeValueWithoutResponse(chunk);
                    } else {
                        await this.bleCharacteristicRx.writeValue(chunk);
                    }
                }
                this.telemetry.packetsSent++;
                this.telemetry.bytesSent += framed.length;
                return true;
            } catch (e) {
                console.error('[LoRa] Error al transmitir por BLE NUS:', e);
                return false;
            }
        }

        if (this.serialPort && this.serialPort.writable) {
            try {
                this.serialWriter = this.serialPort.writable.getWriter();
                await this.serialWriter.write(framed);
                this.serialWriter.releaseLock();
                this.serialWriter = null;

                this.telemetry.packetsSent++;
                this.telemetry.bytesSent += framed.length;
                return true;
            } catch (e) {
                console.error('[LoRa] Error al transmitir por puerto serie:', e);
                return false;
            }
        }

        // Si no hay transceptor hardware conectado en puerto serie ni BLE, reportar false para fallback transparente
        return false;
    }

    public onPacketReceived(cb: LoraPacketCallback) {
        this.rxCallbacks.add(cb);
        return () => this.rxCallbacks.delete(cb);
    }

    public updateConfig(newConfig: Partial<LoraConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    public getConfig(): LoraConfig {
        return { ...this.config };
    }

    public getTelemetry(): LoraTelemetry {
        return { ...this.telemetry };
    }

    public async disconnect() {
        this.telemetry.connected = false;
        this.telemetry.transportType = 'NONE';
        this.rxBuffer = [];
        if (this.serialReader) {
            await this.serialReader.cancel().catch(() => {});
            this.serialReader = null;
        }
        if (this.serialPort) {
            await this.serialPort.close().catch(() => {});
            this.serialPort = null;
        }
        if (this.bleCharacteristicTx) {
            try {
                await this.bleCharacteristicTx.stopNotifications();
            } catch {}
            this.bleCharacteristicTx = null;
        }
        this.bleCharacteristicRx = null;
        if (this.bleServer && this.bleServer.connected) {
            try {
                this.bleServer.disconnect();
            } catch {}
            this.bleServer = null;
        }
        this.bleDevice = null;
    }

    public async destroy(): Promise<void> {
        await this.disconnect();
        this.rxCallbacks.clear();
        LoraSerialBridgeEngine.instance = null as any;
    }
}

export const loraBridge = LoraSerialBridgeEngine.getInstance();

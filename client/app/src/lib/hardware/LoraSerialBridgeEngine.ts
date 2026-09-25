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

import { Capacitor, registerPlugin } from '@capacitor/core';

const RedNode = registerPlugin<any>('RedNode');

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
    transportType: 'USB_SERIAL' | 'USB_NATIVE' | 'BLE_NUS' | 'NONE';
    packetsSent: number;
    packetsReceived: number;
    bytesSent: number;
    bytesReceived: number;
    lastRssiDbm: number | null;
    lastSnrDb: number | null;
    lastPacketTimestamp: number | null;
    driverInfo?: string;
}

export type LoraPacketCallback = (packet: Uint8Array, rssi?: number, snr?: number) => void;
export type LoraRawStreamConsumer = (bytes: Uint8Array, rssi?: number, snr?: number) => void;

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
    private rawStreamConsumers: Set<LoraRawStreamConsumer> = new Set();
    private rxBuffer: number[] = [];

    private serialPort: any = null;
    private serialReader: any = null;
    private serialWriter: any = null;
    private nativeUsbDataListener: any = null;
    private nativeUsbErrorListener: any = null;

    private bleDevice: any = null;
    private bleServer: any = null;
    private bleCharacteristicTx: any = null;
    private bleCharacteristicRx: any = null;
    private bleDeviceDisconnectHandler: any = null;
    private bleCharacteristicChangedHandler: any = null;
    private nativeBleDeviceId: string | null = null;

    // Mutex booleano para serializar escrituras en la rama Web Serial.
    // La API Web Serial lanza TypeError si se llama getWriter() mientras el stream ya está bloqueado.
    private serialWriteLocked: boolean = false;

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

    // ─── Conexión Web Serial / USB-OTG Nativo ────────────────────────────────────

    public async connectWebSerial(baudRate = 115200, deviceId?: number): Promise<boolean> {
        // En entorno nativo Android, conmutar directamente al driver USB-OTG de alto rendimiento
        if (Capacitor.isNativePlatform()) {
            return await this.connectNativeUsbSerial(baudRate, deviceId);
        }

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
            this.telemetry.driverInfo = 'WebSerial';

            this.startSerialReader();
            console.log(`[LoRa] Conectado a transceptor serie USB @ ${baudRate} bps`);
            return true;
        } catch (e) {
            console.error('[LoRa] Error al abrir puerto serie:', e);
            this.telemetry.connected = false;
            return false;
        }
    }

    /**
     * Conexión USB Serial Nativa en Android mediante usb-serial-for-android (CP210x, CH340, FTDI, CDC-ACM)
     */
    public async connectNativeUsbSerial(baudRate = 115200, deviceId?: number): Promise<boolean> {
        try {
            const list = await RedNode.listUsbSerialDevices();
            if (!list || !list.devices || list.devices.length === 0) {
                console.warn('[LoRa] No se encontraron dispositivos USB Serial OTG conectados');
                return false;
            }

            const res = await RedNode.openUsbSerial({
                deviceId: deviceId !== undefined ? deviceId : list.devices[0].deviceId,
                baudRate
            });

            if (!res || !res.success) {
                console.error('[LoRa] openUsbSerial retornó fallo:', res);
                return false;
            }

            // Desvincular listeners anteriores si existían
            if (this.nativeUsbDataListener) {
                try { await this.nativeUsbDataListener.remove(); } catch {}
                this.nativeUsbDataListener = null;
            }
            if (this.nativeUsbErrorListener) {
                try { await this.nativeUsbErrorListener.remove(); } catch {}
                this.nativeUsbErrorListener = null;
            }

            this.nativeUsbDataListener = await RedNode.addListener('usbSerialData', (event: { data: number[] }) => {
                if (event && event.data && event.data.length > 0) {
                    this.feedRawBytes(new Uint8Array(event.data));
                }
            });

            this.nativeUsbErrorListener = await RedNode.addListener('usbSerialError', (err: { error: string }) => {
                console.warn('[LoRa] Error recibido de puerto serie USB:', err);
                this.disconnect();
            });

            this.telemetry.connected = true;
            this.telemetry.transportType = 'USB_NATIVE';
            this.telemetry.driverInfo = `${res.driver || 'USB-UART'} (${res.deviceName || 'OTG'})`;

            console.log(`[LoRa] ✅ Conectado nativamente a ${this.telemetry.driverInfo} @ ${baudRate} bps`);
            return true;
        } catch (e) {
            console.error('[LoRa] Error conectando USB Serial Nativo:', e);
            this.telemetry.connected = false;
            return false;
        }
    }

    public async listAvailableUsbDevices(): Promise<any[]> {
        if (Capacitor.isNativePlatform()) {
            try {
                const res = await RedNode.listUsbSerialDevices();
                return res?.devices || [];
            } catch {
                return [];
            }
        }
        return [];
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
        // En entorno nativo Android/iOS, utilizar BleClient de Capacitor
        if (Capacitor.isNativePlatform()) {
            return await this.connectNativeBleNus();
        }

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

            this.bleDeviceDisconnectHandler = () => {
                console.warn('[LoRa] Dispositivo BLE desconectado');
                this.disconnect();
            };
            this.bleDevice.addEventListener('gattserverdisconnected', this.bleDeviceDisconnectHandler);

            this.bleServer = await this.bleDevice.gatt.connect();
            const service = await this.bleServer.getPrimaryService(LoraSerialBridgeEngine.NORDIC_UART_SERVICE);

            this.bleCharacteristicRx = await service.getCharacteristic(LoraSerialBridgeEngine.NORDIC_UART_RX);
            this.bleCharacteristicTx = await service.getCharacteristic(LoraSerialBridgeEngine.NORDIC_UART_TX);

            await this.bleCharacteristicTx.startNotifications();
            this.bleCharacteristicChangedHandler = (event: any) => {
                const value = event.target.value;
                if (value) {
                    this.feedRawBytes(new Uint8Array(value.buffer));
                }
            };
            this.bleCharacteristicTx.addEventListener('characteristicvaluechanged', this.bleCharacteristicChangedHandler);

            this.telemetry.connected = true;
            this.telemetry.transportType = 'BLE_NUS';
            this.telemetry.driverInfo = `BLE NUS (${this.bleDevice.name || 'LoRa'})`;

            console.log(`[LoRa] Conectado a transceptor LoRa BLE NUS (${this.telemetry.driverInfo})`);
            return true;
        } catch (e) {
            console.error('[LoRa] Error al conectar Bluetooth LE (Web):', e);
            this.telemetry.connected = false;
            return false;
        }
    }

    /**
     * Conexión BLE Nordic UART Service (NUS) nativa en Android/iOS mediante BleClient
     */
    public async connectNativeBleNus(): Promise<boolean> {
        try {
            const { BleClient } = await import('@capacitor-community/bluetooth-le');
            await BleClient.initialize();

            const device = await BleClient.requestDevice({
                services: [LoraSerialBridgeEngine.NORDIC_UART_SERVICE],
                optionalServices: [LoraSerialBridgeEngine.NORDIC_UART_SERVICE],
            }).catch(async () => {
                // Fallback sin filtro restrictivo para transceptores con nombres personalizados
                return await BleClient.requestDevice({
                    optionalServices: [LoraSerialBridgeEngine.NORDIC_UART_SERVICE]
                });
            });

            if (!device || !device.deviceId) {
                console.warn('[LoRa] Selección de dispositivo BLE cancelada o no disponible');
                return false;
            }

            this.nativeBleDeviceId = device.deviceId;

            await BleClient.connect(device.deviceId, (disconnectedId) => {
                console.warn('[LoRa] Dispositivo BLE desconectado por hardware:', disconnectedId);
                this.disconnect();
            });

            // Suscribir notificaciones de TX del transceptor (nuestros bytes RX entrantes)
            await BleClient.startNotifications(
                device.deviceId,
                LoraSerialBridgeEngine.NORDIC_UART_SERVICE,
                LoraSerialBridgeEngine.NORDIC_UART_TX,
                (value) => {
                    if (value && value.buffer) {
                        this.feedRawBytes(new Uint8Array(value.buffer));
                    }
                }
            );

            this.telemetry.connected = true;
            this.telemetry.transportType = 'BLE_NUS';
            this.telemetry.driverInfo = `BLE NUS (${device.name || device.deviceId.slice(0, 8)})`;

            console.log(`[LoRa] ✅ Conectado nativamente a transceptor LoRa BLE NUS: ${this.telemetry.driverInfo}`);
            return true;
        } catch (e) {
            console.error('[LoRa] Error conectando BLE NUS Nativo:', e);
            this.telemetry.connected = false;
            this.nativeBleDeviceId = null;
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

        // Reenviar flujo binario íntegro a decodificadores registrados (e.g. LoRaMeshtasticBridge Protobuf)
        for (const consumer of this.rawStreamConsumers) {
            try { consumer(bytes, rssi, snr); } catch {}
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
        // Si la carga útil ya está encuadrada con cabecera Meshtastic (0x94, 0xC3), omitir encuadre COBS
        if (payload.length >= 4 && payload[0] === 0x94 && payload[1] === 0xC3) {
            return await this.sendRawBytes(payload);
        }
        const framed = LoraSerialBridgeEngine.framePacket(payload);
        return await this.sendRawBytes(framed);
    }

    public async sendRawBytes(bytes: Uint8Array): Promise<boolean> {
        if (this.telemetry.transportType === 'BLE_NUS') {
            // Rama Nativa Android / iOS vía BleClient
            if (this.nativeBleDeviceId && Capacitor.isNativePlatform()) {
                try {
                    const { BleClient } = await import('@capacitor-community/bluetooth-le');
                    const chunkSize = 128;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        const chunk = bytes.slice(i, i + chunkSize);
                        await BleClient.writeWithoutResponse(
                            this.nativeBleDeviceId,
                            LoraSerialBridgeEngine.NORDIC_UART_SERVICE,
                            LoraSerialBridgeEngine.NORDIC_UART_RX,
                            new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                        );
                    }
                    this.telemetry.packetsSent++;
                    this.telemetry.bytesSent += bytes.length;
                    return true;
                } catch (e) {
                    console.error('[LoRa] Error al transmitir por BleClient NUS Nativo:', e);
                    return false;
                }
            }

            // Rama Web Bluetooth de escritorio (Chrome)
            if (this.bleCharacteristicRx) {
                try {
                    // Fragmentar en bloques de MTU BLE (128 bytes) para compatibilidad universal
                    const chunkSize = 128;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        const chunk = bytes.slice(i, i + chunkSize);
                        if (this.bleCharacteristicRx.writeValueWithoutResponse) {
                            await this.bleCharacteristicRx.writeValueWithoutResponse(chunk);
                        } else {
                            await this.bleCharacteristicRx.writeValue(chunk);
                        }
                    }
                    this.telemetry.packetsSent++;
                    this.telemetry.bytesSent += bytes.length;
                    return true;
                } catch (e) {
                    console.error('[LoRa] Error al transmitir por BLE NUS Web:', e);
                    return false;
                }
            }
        }

        if (this.telemetry.transportType === 'USB_NATIVE') {
            try {
                await RedNode.writeUsbSerial({ data: Array.from(bytes) });
                this.telemetry.packetsSent++;
                this.telemetry.bytesSent += bytes.length;
                return true;
            } catch (e) {
                console.error('[LoRa] Error al transmitir por USB Serial Nativo:', e);
                return false;
            }
        }

        if (this.serialPort && this.serialPort.writable) {
            // Mutex de escritura: la Web Serial API lanza si getWriter() se llama con el stream bloqueado
            if (this.serialWriteLocked) {
                console.warn('[LoRa] Escritura serie ignorada: mutex activo (transmisión concurrente en curso)');
                return false;
            }
            try {
                this.serialWriteLocked = true;
                this.serialWriter = this.serialPort.writable.getWriter();
                await this.serialWriter.write(bytes);
                this.serialWriter.releaseLock();
                this.serialWriter = null;

                this.telemetry.packetsSent++;
                this.telemetry.bytesSent += bytes.length;
                return true;
            } catch (e) {
                console.error('[LoRa] Error al transmitir por puerto serie:', e);
                if (this.serialWriter) {
                    try { this.serialWriter.releaseLock(); } catch {}
                    this.serialWriter = null;
                }
                return false;
            } finally {
                this.serialWriteLocked = false;
            }
        }

        // Si no hay transceptor hardware conectado en puerto serie ni BLE, reportar false para fallback transparente
        return false;
    }

    public onPacketReceived(cb: LoraPacketCallback) {
        this.rxCallbacks.add(cb);
        return () => this.rxCallbacks.delete(cb);
    }

    public onRawStream(consumer: LoraRawStreamConsumer): () => void {
        this.rawStreamConsumers.add(consumer);
        return () => this.rawStreamConsumers.delete(consumer);
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

    public get isConnected(): boolean {
        return this.telemetry.connected;
    }

    public async disconnect() {
        if (this.telemetry.transportType === 'USB_NATIVE') {
            if (this.nativeUsbDataListener) {
                try { await this.nativeUsbDataListener.remove(); } catch {}
                this.nativeUsbDataListener = null;
            }
            if (this.nativeUsbErrorListener) {
                try { await this.nativeUsbErrorListener.remove(); } catch {}
                this.nativeUsbErrorListener = null;
            }
            try {
                await RedNode.closeUsbSerial();
            } catch {}
        }

        // Limpieza nativa de BleClient en Android / iOS
        if (this.nativeBleDeviceId && Capacitor.isNativePlatform()) {
            try {
                const { BleClient } = await import('@capacitor-community/bluetooth-le');
                await BleClient.stopNotifications(
                    this.nativeBleDeviceId,
                    LoraSerialBridgeEngine.NORDIC_UART_SERVICE,
                    LoraSerialBridgeEngine.NORDIC_UART_TX
                ).catch(() => {});
                await BleClient.disconnect(this.nativeBleDeviceId).catch(() => {});
            } catch {}
            this.nativeBleDeviceId = null;
        }

        this.telemetry.connected = false;
        this.telemetry.transportType = 'NONE';
        this.telemetry.driverInfo = undefined;
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
                if (this.bleCharacteristicChangedHandler) {
                    this.bleCharacteristicTx.removeEventListener('characteristicvaluechanged', this.bleCharacteristicChangedHandler);
                }
                await this.bleCharacteristicTx.stopNotifications();
            } catch {}
            this.bleCharacteristicTx = null;
        }
        this.bleCharacteristicChangedHandler = null;
        this.bleCharacteristicRx = null;
        if (this.bleDevice && this.bleDeviceDisconnectHandler) {
            try {
                this.bleDevice.removeEventListener('gattserverdisconnected', this.bleDeviceDisconnectHandler);
            } catch {}
            this.bleDeviceDisconnectHandler = null;
        }
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

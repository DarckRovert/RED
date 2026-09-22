/**
 * LoRaMeshtasticBridge.ts — RED Universal LoRa / Meshtastic Hardware & Protocol Adapter
 * 
 * Enables physical long-range (15-30 km) RF radio packet bridging by interfacing
 * directly with Meshtastic ESP32 / nRF52 / SX1262 hardware dongles over WebSerial,
 * Android USB-OTG Serial (CP2102, CH340, FTDI, CDC-ACM), and Bluetooth NUS.
 * 
 * Features:
 * - Full wire-level Protobuf codec for Meshtastic v2.x (ToRadio / FromRadio / MeshPacket / Data)
 * - Fallback support for legacy 16-byte fixed-header binary framing
 * - Transparent encapsulation of RED PQC encrypted packets into LoRa MTU (237 bytes)
 * - Compression and streaming of RED LowBitrateVocoder voice bursts across LoRa
 * - Dual-way framing with Meshtastic packet sync header (0x94, 0xC3)
 * - Dynamic duty-cycle enforcement (EU868 / US915 / AS923 regulatory compliance)
 */

import { loraTdmaScheduler } from './LoRaTdmaSchedulerEngine';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { loraBridge } from '../hardware/LoraSerialBridgeEngine';

const RedNode = registerPlugin<any>('RedNode');

export interface LoRaNodeInfo {
    nodeNum: number;
    user: {
        id: string;
        longName: string;
        shortName: string;
        hwModel: string;
    };
    snr: number;
    rssi: number;
    batteryLevel?: number;
    channel?: number;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    lastSeen?: number;
}

export enum MeshtasticPortNum {
    UNKNOWN_APP = 0,
    TEXT_MESSAGE_APP = 1,
    REMOTE_HARDWARE_APP = 2,
    POSITION_APP = 3,
    NODEINFO_APP = 4,
    ROUTING_APP = 5,
    ADMIN_APP = 6,
    RED_SOVEREIGN_VOCODER_APP = 64, // Custom portnum for RED Vocoder voice bursts
    RED_SOVEREIGN_MESH_APP = 65    // Custom portnum for RED full-mesh encrypted frames
}

export interface LoRaPacket {
    from: number;
    to: number; // 0xFFFFFFFF for broadcast
    channel: number;
    portnum: MeshtasticPortNum;
    payload: Uint8Array;
    id: number;
    rxTime?: number;
    rxSnr?: number;
    rxRssi?: number;
    hopLimit?: number;
    wantAck?: boolean;
}

export type LoRaPacketCallback = (packet: LoRaPacket) => void;

// ─── Meshtastic Protobuf Wire-Level Codec (Zero Dependencies) ───────────────

function encodeVarint(val: number): number[] {
    const res: number[] = [];
    let n = val >>> 0;
    while (n >= 0x80) {
        res.push((n & 0x7F) | 0x80);
        n >>>= 7;
    }
    res.push(n & 0x7F);
    return res;
}

function decodeVarint(buf: Uint8Array, offset: number): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let count = 0;
    while (offset + count < buf.length) {
        const b = buf[offset + count];
        count++;
        result |= (b & 0x7F) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
        if (shift > 35) break;
    }
    return { value: result >>> 0, bytesRead: count };
}

function encodeFixed32(val: number): number[] {
    return [
        val & 0xFF,
        (val >>> 8) & 0xFF,
        (val >>> 16) & 0xFF,
        (val >>> 24) & 0xFF
    ];
}

function decodeFixed32(buf: Uint8Array, offset: number): number {
    if (offset + 4 > buf.length) return 0;
    return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function encodeTag(fieldNum: number, wireType: number): number[] {
    return encodeVarint((fieldNum << 3) | wireType);
}

function encodeVarintField(fieldNum: number, val: number): number[] {
    if (!val) return [];
    return [...encodeTag(fieldNum, 0), ...encodeVarint(val)];
}

function encodeFixed32Field(fieldNum: number, val: number): number[] {
    if (!val) return [];
    return [...encodeTag(fieldNum, 5), ...encodeFixed32(val)];
}

function encodeLengthDelimited(fieldNum: number, bytes: Uint8Array | number[]): number[] {
    const arr = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
    if (!arr || arr.length === 0) return [];
    return [...encodeTag(fieldNum, 2), ...encodeVarint(arr.length), ...arr];
}

function encodeData(portnum: number, payload: Uint8Array, wantResponse?: boolean): number[] {
    const bytes: number[] = [];
    if (portnum) bytes.push(...encodeVarintField(1, portnum));
    if (payload && payload.length > 0) bytes.push(...encodeLengthDelimited(2, payload));
    if (wantResponse) bytes.push(...encodeVarintField(3, 1));
    return bytes;
}

function encodeMeshPacket(pkt: LoRaPacket): number[] {
    const bytes: number[] = [];
    if (pkt.from) bytes.push(...encodeFixed32Field(1, pkt.from));
    if (pkt.to !== undefined) bytes.push(...encodeFixed32Field(2, pkt.to));
    if (pkt.channel) bytes.push(...encodeVarintField(3, pkt.channel));
    const dataBytes = encodeData(pkt.portnum, pkt.payload, pkt.wantAck);
    if (dataBytes.length > 0) bytes.push(...encodeLengthDelimited(4, dataBytes));
    if (pkt.id) bytes.push(...encodeFixed32Field(6, pkt.id));
    if (pkt.hopLimit) bytes.push(...encodeVarintField(9, pkt.hopLimit));
    if (pkt.wantAck) bytes.push(...encodeVarintField(10, 1));
    return bytes;
}

function encodeToRadio(pkt: LoRaPacket): Uint8Array {
    const meshPktBytes = encodeMeshPacket(pkt);
    const toRadioBytes = encodeLengthDelimited(1, meshPktBytes);
    const totalLen = toRadioBytes.length;
    const out = new Uint8Array(4 + totalLen);
    out[0] = 0x94;
    out[1] = 0xC3;
    out[2] = (totalLen >> 8) & 0xFF;
    out[3] = totalLen & 0xFF;
    out.set(toRadioBytes, 4);
    return out;
}

function decodeData(buf: Uint8Array): { portnum: MeshtasticPortNum; payload: Uint8Array; wantResponse?: boolean } {
    let offset = 0;
    let portnum = MeshtasticPortNum.UNKNOWN_APP;
    let payload = new Uint8Array(0);
    let wantResponse = false;
    while (offset < buf.length) {
        const { value: tag, bytesRead: tagLen } = decodeVarint(buf, offset);
        offset += tagLen;
        const fieldNum = tag >>> 3;
        const wireType = tag & 0x07;
        if (wireType === 0) {
            const { value: v, bytesRead: vLen } = decodeVarint(buf, offset);
            offset += vLen;
            if (fieldNum === 1) portnum = v as MeshtasticPortNum;
            if (fieldNum === 3) wantResponse = v !== 0;
        } else if (wireType === 2) {
            const { value: len, bytesRead: lenLen } = decodeVarint(buf, offset);
            offset += lenLen;
            const dataSlice = new Uint8Array(buf.slice(offset, offset + len));
            offset += len;
            if (fieldNum === 2) payload = dataSlice;
        } else if (wireType === 5) {
            offset += 4;
        } else if (wireType === 1) {
            offset += 8;
        } else {
            break;
        }
    }
    return { portnum, payload, wantResponse };
}

function decodePosition(buf: Uint8Array): { latitude?: number; longitude?: number; altitude?: number; batteryLevel?: number } {
    let offset = 0;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let altitude: number | undefined;
    let batteryLevel: number | undefined;

    while (offset < buf.length) {
        const { value: tag, bytesRead: tLen } = decodeVarint(buf, offset);
        offset += tLen;
        const field = tag >>> 3;
        const wire = tag & 0x07;

        if (wire === 5) {
            const val = decodeFixed32(buf, offset);
            offset += 4;
            const sval = (val | 0);
            if (field === 1 && sval !== 0) {
                latitude = sval * 1e-7;
            } else if (field === 2 && sval !== 0) {
                longitude = sval * 1e-7;
            }
        } else if (wire === 0) {
            const { value: v, bytesRead: vLen } = decodeVarint(buf, offset);
            offset += vLen;
            if (field === 3) {
                altitude = v;
            } else if (field === 7) {
                batteryLevel = v;
            }
        } else if (wire === 2) {
            const { value: len, bytesRead: lenLen } = decodeVarint(buf, offset);
            offset += lenLen + len;
        } else {
            break;
        }
    }
    return { latitude, longitude, altitude, batteryLevel };
}

function decodeMeshPacket(buf: Uint8Array): LoRaPacket {
    let offset = 0;
    let from = 0;
    let to = 0xFFFFFFFF;
    let channel = 0;
    let portnum = MeshtasticPortNum.UNKNOWN_APP;
    let payload: Uint8Array = new Uint8Array(0);
    let id = 0;
    let rxTime = 0;
    let rxSnr = 8;
    let rxRssi = -90;
    let hopLimit = 3;
    let wantAck = false;

    while (offset < buf.length) {
        const { value: tag, bytesRead: tagLen } = decodeVarint(buf, offset);
        offset += tagLen;
        const fieldNum = tag >>> 3;
        const wireType = tag & 0x07;

        if (wireType === 0) {
            const { value: v, bytesRead: vLen } = decodeVarint(buf, offset);
            offset += vLen;
            if (fieldNum === 3) channel = v;
            else if (fieldNum === 9) hopLimit = v;
            else if (fieldNum === 10) wantAck = v !== 0;
            else if (fieldNum === 12) rxRssi = (v << 24 >> 24);
        } else if (wireType === 2) {
            const { value: len, bytesRead: lenLen } = decodeVarint(buf, offset);
            offset += lenLen;
            const slice = new Uint8Array(buf.slice(offset, offset + len));
            offset += len;
            if (fieldNum === 4) {
                const decodedData = decodeData(slice);
                portnum = decodedData.portnum;
                payload = decodedData.payload;
                if (decodedData.wantResponse !== undefined) wantAck = decodedData.wantResponse;
            } else if (fieldNum === 5) {
                if (payload.length === 0) payload = slice;
            }
        } else if (wireType === 5) {
            const val = decodeFixed32(buf, offset);
            offset += 4;
            if (fieldNum === 1) from = val;
            else if (fieldNum === 2) to = val;
            else if (fieldNum === 6) id = val;
            else if (fieldNum === 7) rxTime = val;
            else if (fieldNum === 8) {
                const f32View = new Float32Array(new Uint32Array([val]).buffer);
                rxSnr = Math.round(f32View[0] * 10) / 10;
            }
        } else if (wireType === 1) {
            offset += 8;
        } else {
            break;
        }
    }

    return {
        from,
        to,
        channel,
        portnum,
        payload,
        id,
        rxTime,
        rxSnr,
        rxRssi,
        hopLimit,
        wantAck
    };
}

export class LoRaMeshtasticBridge {
    private static instance: LoRaMeshtasticBridge | null = null;

    private isConnected: boolean = false;
    private isNativeUsb: boolean = false;
    private nativeDataListener: any = null;
    private nativeErrorListener: any = null;
    private serialPort: any = null;
    private reader: any = null;
    private writer: any = null;
    private packetListeners: Set<LoRaPacketCallback> = new Set();
    private localNodeInfo: LoRaNodeInfo | null = null;
    private knownNodes: Map<number, LoRaNodeInfo> = new Map();
    private packetCounter: number = 1;
    private rxBuffer: Uint8Array = new Uint8Array(0);

    private constructor() {
        loraTdmaScheduler.setTransmitHandler(async (framed: Uint8Array) => {
            return await this.transmitRawFramed(framed);
        });
        // Enlazar flujo crudo de radio procedente de LoraSerialBridgeEngine
        loraBridge.onRawStream((bytes) => {
            this.feedIncomingBytes(bytes);
        });
    }

    public static getInstance(): LoRaMeshtasticBridge {
        if (!this.instance) {
            this.instance = new LoRaMeshtasticBridge();
        }
        return this.instance;
    }

    /**
     * Registers a listener for inbound LoRa packets
     */
    public onPacket(callback: LoRaPacketCallback): () => void {
        this.packetListeners.add(callback);
        return () => this.packetListeners.delete(callback);
    }

    /**
     * Connects to a physical LoRa module via Android USB-OTG Serial or WebSerial (Chrome / Edge)
     */
    public async connectSerial(baudRate = 115200, deviceId?: number): Promise<boolean> {
        if (Capacitor.isNativePlatform()) {
            return await this.connectNativeSerial(baudRate, deviceId);
        }

        if (typeof navigator === 'undefined' || !(navigator as any).serial) {
            return false;
        }

        try {
            this.serialPort = await (navigator as any).serial.requestPort();
            await this.serialPort.open({ baudRate });
            this.isConnected = true;
            this.isNativeUsb = false;
            this.startReading();
            return true;
        } catch {
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Conexión directa mediante driver nativo Android USB-OTG (CP2102, CH340, FTDI, CDC-ACM)
     */
    public async connectNativeSerial(baudRate = 115200, deviceId?: number): Promise<boolean> {
        try {
            const list = await RedNode.listUsbSerialDevices();
            if (!list || !list.devices || list.devices.length === 0) {
                console.warn('[Meshtastic] No se detectaron dispositivos USB Serial OTG');
                return false;
            }

            const targetId = deviceId !== undefined ? deviceId : list.devices[0].deviceId;
            const res = await RedNode.openUsbSerial({ deviceId: targetId, baudRate });
            if (!res || !res.success) {
                console.error('[Meshtastic] Fallo abriendo puerto nativo:', res);
                return false;
            }

            if (this.nativeDataListener) {
                try { await this.nativeDataListener.remove(); } catch {}
                this.nativeDataListener = null;
            }
            if (this.nativeErrorListener) {
                try { await this.nativeErrorListener.remove(); } catch {}
                this.nativeErrorListener = null;
            }

            this.nativeDataListener = await RedNode.addListener('usbSerialData', (ev: { data: number[] }) => {
                if (ev && ev.data && ev.data.length > 0) {
                    this.feedIncomingBytes(new Uint8Array(ev.data));
                }
            });

            this.nativeErrorListener = await RedNode.addListener('usbSerialError', () => {
                this.disconnect();
            });

            this.isConnected = true;
            this.isNativeUsb = true;
            console.log(`[Meshtastic] ✅ Conectado nativamente a ${res.driver || 'LoRa USB'} @ ${baudRate} bps`);
            return true;
        } catch (e) {
            console.error('[Meshtastic] Error conectando serie nativo:', e);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Disconnects the serial port
     */
    public async disconnect(): Promise<void> {
        this.isConnected = false;
        if (this.isNativeUsb) {
            if (this.nativeDataListener) {
                try { await this.nativeDataListener.remove(); } catch {}
                this.nativeDataListener = null;
            }
            if (this.nativeErrorListener) {
                try { await this.nativeErrorListener.remove(); } catch {}
                this.nativeErrorListener = null;
            }
            try {
                await RedNode.closeUsbSerial();
            } catch {}
            this.isNativeUsb = false;
        }
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
            if (this.serialPort) {
                await this.serialPort.close();
                this.serialPort = null;
            }
        } catch {}
    }

    public getConnectionStatus(): { connected: boolean; isNativeUsb: boolean; nodeInfo: LoRaNodeInfo | null; knownNodesCount: number } {
        return {
            connected: this.isConnected,
            isNativeUsb: this.isNativeUsb,
            nodeInfo: this.localNodeInfo,
            knownNodesCount: this.knownNodes.size
        };
    }

    public getKnownNodes(): LoRaNodeInfo[] {
        return Array.from(this.knownNodes.values());
    }

    public registerDiscoveredNode(nodeInfo: LoRaNodeInfo): void {
        this.knownNodes.set(nodeInfo.nodeNum, nodeInfo);
    }

    public getLocalNodeNum(): number {
        return this.localNodeInfo?.nodeNum || 0x12345678;
    }

    /**
     * Retorna verdadero si hay un transceptor LoRa conectado físicamente (USB, BLE NUS o WebSerial)
     */
    public isRadioConnected(): boolean {
        return this.isConnected || loraBridge.isConnected;
    }

    /**
     * Canaliza la transmisión de tramas crudas encuadradas hacia el canal de hardware activo
     */
    public async transmitRawBytes(framed: Uint8Array): Promise<boolean> {
        return await this.transmitRawFramed(framed);
    }

    /**
     * Encapsulates and broadcasts a raw RED encrypted mesh frame over physical LoRa RF
     */
    public async broadcastMeshFrame(redFrame: Uint8Array): Promise<boolean> {
        return this.sendPacket({
            from: this.localNodeInfo?.nodeNum || 0x12345678,
            to: 0xFFFFFFFF,
            channel: 0,
            portnum: MeshtasticPortNum.RED_SOVEREIGN_MESH_APP,
            payload: redFrame,
            id: this.packetCounter++,
            hopLimit: 3,
            wantAck: false
        });
    }

    /**
     * Encapsulates and broadcasts a low-bitrate vocoder voice note (1.2 kbps) over LoRa RF
     */
    public async broadcastVocoderAudio(encodedPcmChunk: Uint8Array): Promise<boolean> {
        return this.sendPacket({
            from: this.localNodeInfo?.nodeNum || 0x12345678,
            to: 0xFFFFFFFF,
            channel: 0,
            portnum: MeshtasticPortNum.RED_SOVEREIGN_VOCODER_APP,
            payload: encodedPcmChunk,
            id: this.packetCounter++,
            hopLimit: 3,
            wantAck: false
        });
    }

    /**
     * Encapsulates and broadcasts a 28-byte Ultra-Compact Binary CoT-PLI beacon over LoRa RF
     */
    public async broadcastCompactCot(binaryCot: Uint8Array): Promise<boolean> {
        return this.sendPacket({
            from: this.localNodeInfo?.nodeNum || 0x12345678,
            to: 0xFFFFFFFF,
            channel: 0,
            portnum: MeshtasticPortNum.RED_SOVEREIGN_MESH_APP,
            payload: binaryCot,
            id: this.packetCounter++,
            hopLimit: 3,
            wantAck: false
        });
    }

    /**
     * Sends a plain text message compatible with standard Meshtastic nodes
     */
    public async sendTextMessage(text: string, toNodeNum = 0xFFFFFFFF): Promise<boolean> {
        const payload = new TextEncoder().encode(text);
        return this.sendPacket({
            from: this.localNodeInfo?.nodeNum || 0x12345678,
            to: toNodeNum,
            channel: 0,
            portnum: MeshtasticPortNum.TEXT_MESSAGE_APP,
            payload,
            id: this.packetCounter++,
            hopLimit: 3,
            wantAck: toNodeNum !== 0xFFFFFFFF
        });
    }

    /**
     * Low-level framing and transmission of a Meshtastic packet or raw RED frame via TDMA scheduler
     */
    public async sendPacket(packet: LoRaPacket | Uint8Array, bypassTdma = false): Promise<boolean> {
        let loraPkt: LoRaPacket;
        if (packet instanceof Uint8Array) {
            loraPkt = {
                from: this.localNodeInfo?.nodeNum || 0x12345678,
                to: 0xFFFFFFFF,
                channel: 0,
                portnum: MeshtasticPortNum.RED_SOVEREIGN_MESH_APP,
                payload: packet,
                id: this.packetCounter++,
                hopLimit: 3,
                wantAck: false
            };
        } else {
            loraPkt = packet;
        }

        const framed = this.framePacket(loraPkt);

        if (!bypassTdma) {
            let isEmergency = loraPkt.portnum === MeshtasticPortNum.ADMIN_APP;
            if (!isEmergency && loraPkt.payload && loraPkt.payload.length > 0) {
                try {
                    const sample = new TextDecoder().decode(loraPkt.payload.slice(0, 40));
                    if (sample.includes('SOS') || sample.includes('beacon') || sample.includes('CBRN')) {
                        isEmergency = true;
                    }
                } catch {}
            }
            const priority = isEmergency ? 10 : 5;
            return await loraTdmaScheduler.scheduleTransmission(framed, priority, isEmergency);
        }

        return await this.transmitRawFramed(framed, loraPkt);
    }

    private async transmitRawFramed(framed: Uint8Array, packetForLoopback?: LoRaPacket): Promise<boolean> {
        if (loraBridge.isConnected) {
            return await loraBridge.sendRawBytes(framed);
        }

        if (!this.isConnected) {
            if (packetForLoopback) {
                this.dispatchInbound(packetForLoopback);
            } else {
                const unframed = this.unframePacket(framed);
                if (unframed) this.dispatchInbound(unframed);
            }
            return true;
        }

        if (this.isNativeUsb) {
            try {
                await RedNode.writeUsbSerial({ data: Array.from(framed) });
                return true;
            } catch {
                return false;
            }
        }

        if (this.serialPort && this.serialPort.writable) {
            try {
                if (!this.writer) {
                    this.writer = this.serialPort.writable.getWriter();
                }
                await this.writer.write(framed);
                return true;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * Encodes a packet using Meshtastic Wire Protocol (Protobuf ToRadio with 0x94, 0xC3 sync header)
     */
    public framePacket(packet: LoRaPacket): Uint8Array {
        return encodeToRadio(packet);
    }

    /**
     * Decodes a framed Meshtastic byte buffer (Protobuf FromRadio or Legacy Header) back into a LoRaPacket
     */
    public unframePacket(buf: Uint8Array): LoRaPacket | null {
        if (!buf || !(buf instanceof Uint8Array) || buf.length < 4) return null;
        if (buf[0] !== 0x94 || buf[1] !== 0xC3) return null;

        const len = (buf[2] << 8) | buf[3];
        if (len < 4 || buf.length < 4 + len) return null;

        const body = buf.slice(4, 4 + len);

        // Check if body is Protobuf FromRadio (starts with field tags: 1..16, wireTypes 0, 2, 5)
        const firstTag = body[0];
        const firstWire = firstTag & 0x07;
        const firstField = firstTag >>> 3;
        const isProtobuf = (firstWire === 0 || firstWire === 2 || firstWire === 5) && firstField >= 1 && firstField <= 16;

        if (isProtobuf) {
            return this.unframeProtobufFromRadio(body);
        }

        // Legacy 16-byte fixed-header fallback
        return this.unframeLegacyPacket(body, len);
    }

    private unframeProtobufFromRadio(body: Uint8Array): LoRaPacket | null {
        let offset = 0;
        let packet: LoRaPacket | null = null;

        while (offset < body.length) {
            const { value: tag, bytesRead: tagLen } = decodeVarint(body, offset);
            offset += tagLen;
            const fieldNum = tag >>> 3;
            const wireType = tag & 0x07;

            if (wireType === 2) {
                const { value: len, bytesRead: lenLen } = decodeVarint(body, offset);
                offset += lenLen;
                const slice = body.slice(offset, offset + len);
                offset += len;

                if (fieldNum === 2) {
                    // MeshPacket
                    packet = decodeMeshPacket(slice);
                    if (packet.from && packet.from !== 0 && packet.from !== 0xFFFFFFFF) {
                        const existing = this.knownNodes.get(packet.from);
                        let lat = existing?.latitude;
                        let lon = existing?.longitude;
                        let alt = existing?.altitude;
                        let bat = existing?.batteryLevel;

                        // Decodificar posición en tiempo real si el paquete corresponde a POSITION_APP
                        if (packet.portnum === MeshtasticPortNum.POSITION_APP && packet.payload && packet.payload.length > 0) {
                            const pos = decodePosition(packet.payload);
                            if (pos.latitude !== undefined) lat = pos.latitude;
                            if (pos.longitude !== undefined) lon = pos.longitude;
                            if (pos.altitude !== undefined) alt = pos.altitude;
                            if (pos.batteryLevel !== undefined) bat = pos.batteryLevel;
                        }

                        this.knownNodes.set(packet.from, {
                            nodeNum: packet.from,
                            user: existing?.user || {
                                id: `!${packet.from.toString(16).padStart(8, '0')}`,
                                longName: `Meshtastic-${packet.from.toString(16).slice(-4).toUpperCase()}`,
                                shortName: packet.from.toString(16).slice(-4).toUpperCase(),
                                hwModel: 'SX1262'
                            },
                            snr: packet.rxSnr ?? 8,
                            rssi: packet.rxRssi ?? -90,
                            channel: packet.channel,
                            latitude: lat,
                            longitude: lon,
                            altitude: alt,
                            batteryLevel: bat,
                            lastSeen: Date.now()
                        });
                    }
                } else if (fieldNum === 3) {
                    // MyNodeInfo
                    this.decodeMyInfo(slice);
                } else if (fieldNum === 4) {
                    // NodeInfo
                    this.decodeNodeInfo(slice);
                }
            } else if (wireType === 0) {
                const { bytesRead: vLen } = decodeVarint(body, offset);
                offset += vLen;
            } else if (wireType === 5) {
                offset += 4;
            } else if (wireType === 1) {
                offset += 8;
            } else {
                break;
            }
        }

        return packet;
    }

    private decodeMyInfo(slice: Uint8Array): void {
        let offset = 0;
        let myNum = 0;
        while (offset < slice.length) {
            const { value: tag, bytesRead: tLen } = decodeVarint(slice, offset);
            offset += tLen;
            const field = tag >>> 3;
            const wire = tag & 0x07;
            if (field === 1) {
                if (wire === 0) {
                    const { value: v, bytesRead: vLen } = decodeVarint(slice, offset);
                    myNum = v;
                    offset += vLen;
                } else if (wire === 5) {
                    myNum = decodeFixed32(slice, offset);
                    offset += 4;
                } else {
                    break;
                }
            } else if (wire === 0) {
                const { bytesRead: vLen } = decodeVarint(slice, offset);
                offset += vLen;
            } else if (wire === 2) {
                const { value: skipLen, bytesRead: sklLen } = decodeVarint(slice, offset);
                offset += sklLen + skipLen;
            } else if (wire === 5) {
                offset += 4;
            } else if (wire === 1) {
                offset += 8;
            } else {
                break;
            }
        }
        if (myNum) {
            this.localNodeInfo = {
                nodeNum: myNum,
                user: {
                    id: `!${myNum.toString(16).padStart(8, '0')}`,
                    longName: `RED-Local-${myNum.toString(16).slice(-4).toUpperCase()}`,
                    shortName: myNum.toString(16).slice(-4).toUpperCase(),
                    hwModel: 'Heltec/T-Beam'
                },
                snr: 10,
                rssi: -80
            };
        }
    }

    private decodeNodeInfo(slice: Uint8Array): void {
        let offset = 0;
        let num = 0;
        let snr = 8;
        let longName = '';
        let shortName = '';
        while (offset < slice.length) {
            const { value: tag, bytesRead: tLen } = decodeVarint(slice, offset);
            offset += tLen;
            const field = tag >>> 3;
            const wire = tag & 0x07;
            if (field === 1) {
                if (wire === 0) {
                    const { value: v, bytesRead: vLen } = decodeVarint(slice, offset);
                    num = v;
                    offset += vLen;
                } else if (wire === 5) {
                    num = decodeFixed32(slice, offset);
                    offset += 4;
                } else {
                    break;
                }
            } else if (wire === 2 && field === 2) {
                // user info submessage
                const { value: uLen, bytesRead: ulLen } = decodeVarint(slice, offset);
                offset += ulLen;
                const userSlice = slice.slice(offset, offset + uLen);
                offset += uLen;
                let uOff = 0;
                while (uOff < userSlice.length) {
                    const { value: uTag, bytesRead: utLen } = decodeVarint(userSlice, uOff);
                    uOff += utLen;
                    const uField = uTag >>> 3;
                    const uWire = uTag & 0x07;
                    if (uWire === 2) {
                        const { value: sLen, bytesRead: slLen } = decodeVarint(userSlice, uOff);
                        uOff += slLen;
                        const strBytes = userSlice.slice(uOff, uOff + sLen);
                        uOff += sLen;
                        const decoded = new TextDecoder().decode(strBytes);
                        if (uField === 2) longName = decoded;
                        if (uField === 3) shortName = decoded;
                    } else if (uWire === 0) {
                        const { bytesRead: uvLen } = decodeVarint(userSlice, uOff);
                        uOff += uvLen;
                    } else if (uWire === 5) {
                        uOff += 4;
                    } else if (uWire === 1) {
                        uOff += 8;
                    } else {
                        break;
                    }
                }
            } else if (wire === 5 && field === 4) {
                const f32View = new Float32Array(new Uint32Array([decodeFixed32(slice, offset)]).buffer);
                snr = Math.round(f32View[0] * 10) / 10;
                offset += 4;
            } else if (wire === 2 && field === 3) {
                // position submessage
                const { value: pLen, bytesRead: plLen } = decodeVarint(slice, offset);
                offset += plLen;
                const posSlice = slice.slice(offset, offset + pLen);
                offset += pLen;
                const pos = decodePosition(posSlice);
                const existing = num ? this.knownNodes.get(num) : undefined;
                if (num) {
                    this.knownNodes.set(num, {
                        nodeNum: num,
                        user: existing?.user || {
                            id: `!${num.toString(16).padStart(8, '0')}`,
                            longName: longName || `Node-${num.toString(16).slice(-4).toUpperCase()}`,
                            shortName: shortName || num.toString(16).slice(-4).toUpperCase(),
                            hwModel: 'SX1262'
                        },
                        snr,
                        rssi: existing?.rssi ?? -90,
                        latitude: pos.latitude !== undefined ? pos.latitude : existing?.latitude,
                        longitude: pos.longitude !== undefined ? pos.longitude : existing?.longitude,
                        altitude: pos.altitude !== undefined ? pos.altitude : existing?.altitude,
                        batteryLevel: pos.batteryLevel !== undefined ? pos.batteryLevel : existing?.batteryLevel,
                        lastSeen: Date.now()
                    });
                }
            } else if (wire === 0) {
                const { bytesRead: vLen } = decodeVarint(slice, offset);
                offset += vLen;
            } else if (wire === 2) {
                const { value: skipLen, bytesRead: sklLen } = decodeVarint(slice, offset);
                offset += sklLen + skipLen;
            } else if (wire === 5) {
                offset += 4;
            } else if (wire === 1) {
                offset += 8;
            } else {
                break;
            }
        }
        if (num && !this.knownNodes.has(num)) {
            this.knownNodes.set(num, {
                nodeNum: num,
                user: {
                    id: `!${num.toString(16).padStart(8, '0')}`,
                    longName: longName || `Node-${num.toString(16).slice(-4).toUpperCase()}`,
                    shortName: shortName || num.toString(16).slice(-4).toUpperCase(),
                    hwModel: 'SX1262'
                },
                snr,
                rssi: -90,
                lastSeen: Date.now()
            });
        }
    }

    private unframeLegacyPacket(buf: Uint8Array, len: number): LoRaPacket | null {
        if (len < 16) return null;
        const dv = new DataView(buf.buffer, buf.byteOffset, len);
        const from = dv.getUint32(0, false);
        const to = dv.getUint32(4, false);
        const channel = dv.getUint8(8);
        const portnum = dv.getUint8(9) as MeshtasticPortNum;
        const id = dv.getUint32(10, false);
        const hopLimit = dv.getUint8(14);
        const wantAck = dv.getUint8(15) === 1;
        const payload = new Uint8Array(buf.slice(16, len));

        return {
            from,
            to,
            channel,
            portnum,
            id,
            hopLimit,
            wantAck,
            payload
        };
    }

    public feedIncomingBytes(value: Uint8Array): void {
        const newBuf = new Uint8Array(this.rxBuffer.length + value.length);
        newBuf.set(this.rxBuffer, 0);
        newBuf.set(value, this.rxBuffer.length);
        this.rxBuffer = newBuf;

        // Protección de sobreflujo de memoria para dispositivos de recursos restringidos (Moto G22 / Redmi Note 14)
        if (this.rxBuffer.length > 4096) {
            this.rxBuffer = this.rxBuffer.slice(-512);
        }

        while (this.rxBuffer.length >= 4) {
            const syncIdx = this.findSyncHeader(this.rxBuffer);
            if (syncIdx === -1) {
                // Preservar byte 0x94 si quedó al final del buffer entre trozos de recepción
                this.rxBuffer = (this.rxBuffer.length > 0 && this.rxBuffer[this.rxBuffer.length - 1] === 0x94)
                    ? new Uint8Array([0x94])
                    : new Uint8Array(0);
                break;
            }
            if (syncIdx > 0) {
                this.rxBuffer = this.rxBuffer.slice(syncIdx);
            }
            if (this.rxBuffer.length < 4) break;

            const frameLen = (this.rxBuffer[2] << 8) | this.rxBuffer[3];
            // En Meshtastic v2 sobre LoRa MTU (237B), las tramas no exceden 512B ni bajan de 4B
            if (frameLen < 4 || frameLen > 512) {
                // Cabecera corrupta por ruido RF: descartar marcador y resincronizar
                this.rxBuffer = this.rxBuffer.slice(2);
                continue;
            }

            const totalFrameLen = 4 + frameLen;
            if (this.rxBuffer.length < totalFrameLen) break;

            const frameBytes = this.rxBuffer.slice(0, totalFrameLen);
            this.rxBuffer = this.rxBuffer.slice(totalFrameLen);

            const packet = this.unframePacket(frameBytes);
            if (packet) {
                this.dispatchInbound(packet);
            }
        }
    }

    private async startReading(): Promise<void> {
        while (this.isConnected && this.serialPort?.readable) {
            try {
                this.reader = this.serialPort.readable.getReader();
                while (true) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    if (value) {
                        this.feedIncomingBytes(value);
                    }
                }
            } catch {
                break;
            } finally {
                if (this.reader) {
                    this.reader.releaseLock();
                    this.reader = null;
                }
            }
        }
    }

    private findSyncHeader(buf: Uint8Array): number {
        for (let i = 0; i < buf.length - 1; i++) {
            if (buf[i] === 0x94 && buf[i + 1] === 0xC3) return i;
        }
        return -1;
    }

    private dispatchInbound(packet: LoRaPacket): void {
        for (const listener of this.packetListeners) {
            try {
                listener(packet);
            } catch {}
        }
    }

    /**
     * Libera recursos serie, vacía listeners y reinicia la instancia singleton
     */
    public async destroy(): Promise<void> {
        await this.disconnect();
        this.packetListeners.clear();
        this.knownNodes.clear();
        this.localNodeInfo = null;
        this.rxBuffer = new Uint8Array(0);
        LoRaMeshtasticBridge.instance = null;
    }
}

export const loraMeshtastic = LoRaMeshtasticBridge.getInstance();

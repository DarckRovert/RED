import { BleClient, numberToUUID, ScanResult } from '@capacitor-community/bluetooth-le';
import { dynamicBearerGovernor } from './DynamicBearerGovernor';
import { KineticDutyGovernor, DutyCycleProfile } from '../sensors/KineticDutyGovernor';

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
    private linkMetrics: Map<string, LinkQualityMetrics> = new Map();
    private negotiatedMtu: Map<string, number> = new Map();

    // ─── Duty-Cycle Táctico de Escaneo BLE ────────────────────────────────────
    // Ventanas de escaneo activo + reposo según perfil KineticDutyGovernor:
    //   SHAKE_BOOST / HIGH_PERFORMANCE  : 1.5 s activo  /  3 s reposo
    //   BALANCED_PATROL                 : 4 s activo    / 11 s reposo
    //   SURVIVAL_SENTRY                 : 4 s activo    / 26 s reposo
    private dutyCycleTimer: any = null;
    private dutyCycleActive = false;
    private dutyCycleCallback: ((device: RedDevice) => void) | null = null;

    private cancelRest: (() => void) | null = null;

    /** Computa (activeScanMs, restMs) desde el bleScanIntervalMs del gobernador. */
    private getDutyCycleWindows(profile: DutyCycleProfile): { activeScanMs: number; restMs: number } {
        switch (profile) {
            case 'SHAKE_BOOST':
            case 'HIGH_PERFORMANCE':
                return { activeScanMs: 1500, restMs: 3000 };
            case 'BALANCED_PATROL':
                return { activeScanMs: 4000, restMs: 11000 };
            case 'SURVIVAL_SENTRY':
            default:
                return { activeScanMs: 4000, restMs: 26000 };
        }
    }

    /**
     * Inicia el ciclo de escaneo BLE con ventanas asimétricas de actividad/reposo.
     * El disparador cinético (Shake/vuelta a primer plano) lanza inmediatamente
     * una ventana de escaneo fuera de turno.
     */
    public startDutyCycleScan(onDeviceFound: (device: RedDevice) => void): void {
        if (this.dutyCycleActive) return;
        this.dutyCycleActive = true;
        this.dutyCycleCallback = onDeviceFound;

        const runCycle = async () => {
            if (!this.dutyCycleActive) return;

            const governor = KineticDutyGovernor.getInstance();
            const telemetry = governor.getTelemetry();
            const { activeScanMs, restMs } = this.getDutyCycleWindows(telemetry.currentProfile);

            // Active scan window
            await this.scan(onDeviceFound, activeScanMs);

            // Rest window — unless a shake boost interrupts us
            if (this.dutyCycleActive) {
                await new Promise<void>((resolve) => {
                    let cleanedUp = false;
                    let unsubFn: (() => void) | null = null;
                    const initialProfile = telemetry.currentProfile;

                    const cleanup = () => {
                        if (cleanedUp) return;
                        cleanedUp = true;
                        this.cancelRest = null;
                        if (unsubFn) {
                            unsubFn();
                            unsubFn = null;
                        }
                        if (this.dutyCycleTimer) {
                            clearTimeout(this.dutyCycleTimer);
                            this.dutyCycleTimer = null;
                        }
                        resolve();
                    };

                    this.cancelRest = cleanup;
                    const restTimer = setTimeout(cleanup, restMs);
                    this.dutyCycleTimer = restTimer;

                    let isSubscribing = true;
                    const unsub = governor.subscribe((t) => {
                        // Ignorar la primera invocación sincrónica al suscribirse
                        if (isSubscribing) return;

                        // Despertar anticipado si el perfil cambia a uno de alta energía (movimiento/sacudida)
                        if (t.currentProfile !== initialProfile &&
                           (t.currentProfile === 'SHAKE_BOOST' || t.currentProfile === 'HIGH_PERFORMANCE')) {
                            cleanup();
                        }
                    });
                    unsubFn = unsub;
                    isSubscribing = false;

                    if (cleanedUp && unsubFn) {
                        unsubFn();
                        unsubFn = null;
                    }
                });
            }

            // Schedule next cycle
            if (this.dutyCycleActive) {
                runCycle();
            }
        };

        runCycle();
    }

    /** Detiene el ciclo de escaneo BLE activo. */
    public stopDutyCycleScan(): void {
        this.dutyCycleActive = false;
        this.dutyCycleCallback = null;
        if (this.cancelRest) {
            this.cancelRest();
            this.cancelRest = null;
        }
        if (this.dutyCycleTimer) {
            clearTimeout(this.dutyCycleTimer);
            this.dutyCycleTimer = null;
        }
        this.stopPhysicalScanIfIdle().catch(() => {});
    }

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

        // Feed real physical radio RSSI into DynamicBearerGovernor
        dynamicBearerGovernor.updateBearerRssi('BLE', rssi);
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

    // ─── Árbitro Unificado de Escaneo BLE Multiplexado ────────────────────────
    private rawScanListeners: Map<string, (result: ScanResult) => void> = new Map();
    private continuousScanRequesters: Set<string> = new Set();
    private scanDeviceListeners: Map<string, (device: RedDevice) => void> = new Map();
    private activeScanHolders = 0;
    private isScanning = false;
    private scanStartingPromise: Promise<void> | null = null;

    /**
     * Inicia o mantiene activa la sesión física de escaneo BLE si no está ya corriendo.
     * Garantiza una única llamada nativa a BleClient.requestLEScan multiplexando
     * los paquetes recibidos a todos los consumidores registrados.
     */
    private async ensurePhysicalScanRunning(): Promise<void> {
        if (this.isScanning) return;
        if (this.scanStartingPromise) {
            await this.scanStartingPromise;
            return;
        }

        this.scanStartingPromise = (async () => {
            await this.init();
            try {
                this.isScanning = true;
                await BleClient.requestLEScan(
                    { allowDuplicates: false },
                    (result: ScanResult) => {
                        // 1. Fan-out inmediato a escuchas crudos (SIGINT C-UAS, analizadores de espectro)
                        this.rawScanListeners.forEach((listener) => {
                            try { listener(result); } catch (e) { console.warn('[BLE-Arbiter] Listener error:', e); }
                        });

                        // 2. Filtrado y notificación canónica para pares de la malla RED
                        const devName = result.device?.name ?? (result as any).localName ?? '';
                        const hasRedService = result.uuids?.some(
                            (uuid) => uuid.toLowerCase() === RED_BLE_SERVICE.toLowerCase()
                        );

                        if (devName.startsWith('RED-') || hasRedService || (result.serviceData && Object.keys(result.serviceData).some(k => k.includes('1818') || k.includes('5246')))) {
                            const rssi = result.rssi ?? -85;
                            this.recordRssi(result.device.deviceId, rssi);
                            const device: RedDevice = {
                                id: result.device.deviceId,
                                name: devName || 'Dispositivo RED',
                                rssi
                            };
                            this.scanDeviceListeners.forEach((listener) => {
                                try { listener(device); } catch (e) { console.warn('[BLE] Scan listener error:', e); }
                            });
                        }
                    }
                );
            } catch (e) {
                console.warn('[BLE-Arbiter] Failed to start physical scan:', e);
                this.isScanning = false;
            } finally {
                this.scanStartingPromise = null;
            }
        })();

        await this.scanStartingPromise;
    }

    /**
     * Detiene el escaneo físico si y solo si ningún consumidor continuo ni ventana temporal
     * de escaneo requiere el hardware de radio activo.
     */
    public async stopPhysicalScanIfIdle(): Promise<void> {
        if (this.scanStartingPromise) {
            try { await this.scanStartingPromise; } catch {}
        }
        if (this.continuousScanRequesters.size > 0) {
            // Hay consumidores continuos activos (ej: RfSigintWatchdogEngine)
            return;
        }
        if (this.activeScanHolders > 0) {
            // Hay ventanas temporales activas (mesh duty-cycle o modal de espectro)
            return;
        }
        if (this.isScanning) {
            try {
                await BleClient.stopLEScan();
            } catch (e) {
                console.warn('[BLE-Arbiter] Stop scan warning:', e);
            }
            this.isScanning = false;
        }
    }

    /**
     * Registra un consumidor de escaneo continuo (ej. radar SIGINT / monitor de espectro)
     * manteniendo el hardware activo sin ser interrumpido por el duty-cycle del mesh.
     */
    public async startContinuousScan(requesterId: string, listener: (result: ScanResult) => void): Promise<void> {
        this.continuousScanRequesters.add(requesterId);
        this.rawScanListeners.set(requesterId, listener);
        await this.ensurePhysicalScanRunning();
    }

    /**
     * Da de baja un consumidor de escaneo continuo. Si no quedan otros requerimientos,
     * el hardware BLE entra en reposo.
     */
    public async stopContinuousScan(requesterId: string): Promise<void> {
        this.continuousScanRequesters.delete(requesterId);
        this.rawScanListeners.delete(requesterId);
        await this.stopPhysicalScanIfIdle();
    }

    /**
     * Realiza un escaneo temporal para descubrimiento de pares RED.
     * Es multiplexado y compatible con múltiples invocaciones simultáneas.
     */
    async scan(onDeviceFound: (device: RedDevice) => void, timeoutMs: number = 4000) {
        const listenerId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        this.activeScanHolders++;
        this.scanDeviceListeners.set(listenerId, onDeviceFound);
        await this.ensurePhysicalScanRunning();

        try {
            await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        } finally {
            this.scanDeviceListeners.delete(listenerId);
            this.activeScanHolders = Math.max(0, this.activeScanHolders - 1);
            await this.stopPhysicalScanIfIdle();
        }
    }

    private connectingSet: Set<string> = new Set();

    public static isMacAddress(id: string): boolean {
        return /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(id.trim());
    }

    public static isIosBleUuid(id: string): boolean {
        const clean = id.trim();
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(clean) ||
               /^[0-9a-fA-F]{32}$/i.test(clean);
    }

    public sanitizeBleDeviceId(id: string): string {
        if (!id) return '';
        const trimmed = id.trim();
        if (BluetoothTransport.isMacAddress(trimmed) || BluetoothTransport.isIosBleUuid(trimmed)) {
            return trimmed.toUpperCase();
        }
        return trimmed;
    }

    private async resolveTargetMac(deviceId: string): Promise<string | null> {
        if (!deviceId) return null;
        const sanitized = this.sanitizeBleDeviceId(deviceId);

        // 1. Si es MAC válida o UUID de iOS CoreBluetooth, usar directamente
        if (BluetoothTransport.isMacAddress(sanitized) || BluetoothTransport.isIosBleUuid(sanitized)) {
            return sanitized;
        }

        // 2. Consultar si meshRouter conoce el Hardware ID (MAC o UUID)
        try {
            const { meshRouter } = await import('./meshRouter');
            const hw = meshRouter.getHardwareId(deviceId);
            if (hw) {
                const sanitizedHw = this.sanitizeBleDeviceId(hw);
                if (BluetoothTransport.isMacAddress(sanitizedHw) || BluetoothTransport.isIosBleUuid(sanitizedHw)) {
                    return sanitizedHw;
                }
            }
        } catch {}

        // 3. Fallback: formato aceptable por BleClient (al menos 8 caracteres alfanuméricos o con separadores)
        if (/^[0-9a-fA-F:-]{8,}$/i.test(sanitized)) {
            return sanitized;
        }

        return null;
    }

    async connect(deviceId: string): Promise<boolean> {
        const targetId = await this.resolveTargetMac(deviceId);
        if (!targetId) {
            return false;
        }
        await this.init();
        if (this.connectedDevices.has(targetId)) return true;
        if (this.connectingSet.has(targetId)) {
            // Wait for existing connection attempt
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 100));
                if (this.connectedDevices.has(targetId)) return true;
                if (!this.connectingSet.has(targetId)) break;
            }
        }

        this.connectingSet.add(targetId);
        try {
            await BleClient.connect(targetId);
            this.connectedDevices.add(targetId);

            // Request adaptive MTU (512 bytes for maximum throughput)
            try {
                if (typeof (BleClient as any).requestMtu === 'function') {
                    await (BleClient as any).requestMtu(targetId, 512);
                    this.negotiatedMtu.set(targetId, 500);
                } else {
                    this.negotiatedMtu.set(targetId, 480);
                }
            } catch {
                this.negotiatedMtu.set(targetId, 240); // Safe fallback
            }

            try {
                await BleClient.startNotifications(targetId, RED_BLE_SERVICE, RED_BLE_NOTIFY_CHAR, (value) => {
                    this.processIncomingChunk(targetId, new Uint8Array(value.buffer));
                });
            } catch (notifErr) {
                console.warn('[BLE] startNotifications non-fatal:', notifErr);
            }

            console.log(`[BLE] Successfully connected GATT to ${targetId.slice(0, 8)}`);
            return true;
        } catch (e) {
            console.warn(`[BLE] Direct GATT connect failed for ${targetId.slice(0, 8)}:`, e);
            this.connectedDevices.delete(targetId);
            return false;
        } finally {
            this.connectingSet.delete(targetId);
        }
    }

    async disconnect(deviceId: string) {
        const targetId = (await this.resolveTargetMac(deviceId)) || this.sanitizeBleDeviceId(deviceId);
        if (!this.connectedDevices.has(targetId)) return;
        try {
            await BleClient.disconnect(targetId);
        } catch {}
        this.connectedDevices.delete(targetId);
        this.negotiatedMtu.delete(targetId);
        const entry = this.incomingBuffers.get(targetId);
        if (entry?.timer) clearTimeout(entry.timer);
        this.incomingBuffers.delete(targetId);
    }

    async send(deviceId: string, payload: Uint8Array): Promise<boolean> {
        const targetId = await this.resolveTargetMac(deviceId);
        if (!targetId) {
            return false;
        }

        const unsuppUntil = this.unsupportedDevices.get(targetId);
        if (unsuppUntil && Date.now() < unsuppUntil) {
            return false;
        }

        let isConnected = this.connectedDevices.has(targetId);
        if (!isConnected) {
            isConnected = await this.connect(targetId);
        }

        const metrics = this.linkMetrics.get(targetId) || {
            deviceId: targetId,
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
            this.linkMetrics.set(targetId, metrics);
            return false;
        }

        try {
            const CHUNK_SIZE = this.negotiatedMtu.get(targetId) || 128;
            const totalLength = payload.length;

            // Direct streaming chunking without corrupting payload with ambiguous 0xAA 0x55 header
            let offset = 0;
            while (offset < totalLength) {
                const sliceLength = Math.min(CHUNK_SIZE, totalLength - offset);
                const chunk = payload.slice(offset, offset + sliceLength);

                const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
                let writeOk = false;
                try {
                    await BleClient.writeWithoutResponse(targetId, RED_BLE_SERVICE, RED_BLE_WRITE_CHAR, dataView);
                    writeOk = true;
                } catch (writeNoRespErr) {
                    try {
                        await BleClient.write(targetId, RED_BLE_SERVICE, RED_BLE_WRITE_CHAR, dataView);
                        writeOk = true;
                    } catch (writeWithRespErr) {
                        console.warn('[BLE] Write retry failed:', writeWithRespErr);
                    }
                }
                offset += sliceLength;
                
                // Controlled delay (25ms) to prevent GATT queue saturation on Android controllers (Moto G / Lenovo)
                await new Promise(r => setTimeout(r, 25));
            }

            metrics.packetsAcked += 1;
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(targetId, metrics);
            return true;
        } catch (e: any) {
            const errMsg = String(e?.message || e || '');
            if (errMsg.includes('Characteristic not found') || errMsg.includes('Service not found')) {
                this.unsupportedDevices.set(targetId, Date.now() + 45000);
            }
            console.error("BLE Send failed:", e);
            metrics.lossRate = 1 - (metrics.packetsAcked / Math.max(1, metrics.packetsSent));
            metrics.lqs = this.calculateLqs(metrics.rssi, metrics.lossRate);
            this.linkMetrics.set(targetId, metrics);
            return false;
        }
    }

    private incomingBuffers: Map<string, { buffer: Uint8Array; expectedLen: number; timer: any }> = new Map();

    onMessage(callback: (msg: {from: string, payload: Uint8Array}) => void) {
        this.messageListeners.push(callback);
    }

    /**
     * Helper to detect complete JSON frames in incoming buffer for immediate delivery
     */
    private findCompleteJsonLength(buffer: Uint8Array): number {
        if (buffer.length === 0) return 0;
        const firstChar = buffer[0];
        if (firstChar !== 0x7B /* '{' */ && firstChar !== 0x5B /* '[' */) return 0;
        
        const openChar = firstChar;
        const closeChar = firstChar === 0x7B ? 0x7D /* '}' */ : 0x5D /* ']' */;
        
        let depth = 0;
        let inString = false;
        let isEscaped = false;

        for (let i = 0; i < buffer.length; i++) {
            const b = buffer[i];
            if (inString) {
                if (isEscaped) {
                    isEscaped = false;
                } else if (b === 0x5C /* '\\' */) {
                    isEscaped = true;
                } else if (b === 0x22 /* '"' */) {
                    inString = false;
                }
            } else {
                if (b === 0x22 /* '"' */) {
                    inString = true;
                } else if (b === openChar) {
                    depth++;
                } else if (b === closeChar) {
                    depth--;
                    if (depth === 0) {
                        return i + 1;
                    }
                }
            }
        }
        return 0;
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
            const view = new DataView(entry.buffer.buffer, entry.buffer.byteOffset, entry.buffer.byteLength);

            if (entry.expectedLen === 0) {
                // 1. Raw RED MeshPacket (Magic 0x52454401 at offset 0)
                if (view.getUint32(0, false) === 0x52454401) {
                    if (entry.buffer.length >= 96) {
                        const payloadLen = view.getUint16(70, true);
                        entry.expectedLen = 96 + payloadLen;
                    } else {
                        break; // Wait for full 96-byte RED header
                    }
                } else {
                    // 2. Direct JSON envelope detection (e.g. handshakes, P2P announcements)
                    const jsonLen = this.findCompleteJsonLength(entry.buffer);
                    if (jsonLen > 0) {
                        entry.expectedLen = jsonLen;
                    } else if (entry.buffer[0] === 0x7B || entry.buffer[0] === 0x5B) {
                        // Incomplete JSON object/array — wait for more chunks
                        break;
                    } else {
                        // 3. Scan for magic 0x52454401 to resynchronize buffer
                        let syncIdx = -1;
                        for (let i = 1; i <= entry.buffer.length - 4; i++) {
                            if (view.getUint32(i, false) === 0x52454401) {
                                syncIdx = i;
                                break;
                            }
                        }
                        if (syncIdx > 0) {
                            entry.buffer = entry.buffer.slice(syncIdx);
                            continue;
                        } else {
                            // 4. Fallback: check 4-byte big-endian length prefix for custom payloads
                            const totalLen = view.getUint32(0, false);
                            if (totalLen > 0 && totalLen <= 10 * 1024 * 1024) {
                                entry.expectedLen = 4 + totalLen;
                            } else {
                                break;
                            }
                        }
                    }
                }
            }

            if (entry.expectedLen > 0 && entry.buffer.length >= entry.expectedLen) {
                const packetSlice = entry.buffer.slice(0, entry.expectedLen);
                entry.buffer = entry.buffer.slice(entry.expectedLen);
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

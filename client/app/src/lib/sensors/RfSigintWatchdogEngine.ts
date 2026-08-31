/**
 * RfSigintWatchdogEngine.ts — RED Tactical RF Spectrum & Drone C-UAS SIGINT Watchdog
 * 
 * Passively analyzes local Bluetooth Low Energy (BLE) advertisement packets and manufacturer payloads
 * to detect OpenDroneID / Remote ID broadcasts, physical asset tracking beacons (AirTag, SmartTag, Tile),
 * and adversarial radio surveillance proximity.
 */

import { BleClient } from '@capacitor-community/bluetooth-le';

export type SigintThreatLevel = 'CLEAR' | 'ELEVATED' | 'HOSTILE_SURVEILLANCE' | 'DRONE_DETECTED';
export type EmitterType = 'UNKNOWN_BLE' | 'OPEN_DRONE_ID' | 'APPLE_FIND_MY' | 'TILE_TRACKER' | 'MESH_PEER';

export interface DetectedEmitter {
    deviceId: string;
    name?: string;
    rssi: number;
    estimatedDistanceMeters: number;
    type: EmitterType;
    firstSeen: number;
    lastSeen: number;
    isSuspicious: boolean;
}

export interface SigintTelemetry {
    threatLevel: SigintThreatLevel;
    activeEmittersCount: number;
    suspiciousEmittersCount: number;
    closestDrone: DetectedEmitter | null;
    closestSuspiciousEmitter: DetectedEmitter | null;
    isScanning: boolean;
}

export class RfSigintWatchdogEngine {
    private static instance: RfSigintWatchdogEngine | null = null;
    private emitters: Map<string, DetectedEmitter> = new Map();
    private isScanning: boolean = false;
    private scanInterval: any = null;
    private listeners: Set<(t: SigintTelemetry) => void> = new Set();

    private constructor() {}

    public static getInstance(): RfSigintWatchdogEngine {
        if (!this.instance) {
            this.instance = new RfSigintWatchdogEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: SigintTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.getTelemetry());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const telemetry = this.getTelemetry();
        this.listeners.forEach(cb => {
            try { cb(telemetry); } catch {}
        });
    }

    public getTelemetry(): SigintTelemetry {
        const now = Date.now();
        // Filtrar emisores vistos en los últimos 45 segundos
        const active = Array.from(this.emitters.values()).filter(e => (now - e.lastSeen) < 45000);
        const suspicious = active.filter(e => e.isSuspicious);
        const drones = active.filter(e => e.type === 'OPEN_DRONE_ID');

        let threatLevel: SigintThreatLevel = 'CLEAR';
        if (drones.length > 0) threatLevel = 'DRONE_DETECTED';
        else if (suspicious.length >= 3) threatLevel = 'HOSTILE_SURVEILLANCE';
        else if (suspicious.length > 0) threatLevel = 'ELEVATED';

        const sortedByDist = [...active].sort((a, b) => a.estimatedDistanceMeters - b.estimatedDistanceMeters);
        const closestDrone = drones.length > 0 ? drones.sort((a, b) => a.estimatedDistanceMeters - b.estimatedDistanceMeters)[0] : null;
        const closestSuspicious = suspicious.length > 0 ? suspicious.sort((a, b) => a.estimatedDistanceMeters - b.estimatedDistanceMeters)[0] : null;

        return {
            threatLevel,
            activeEmittersCount: active.length,
            suspiciousEmittersCount: suspicious.length,
            closestDrone,
            closestSuspiciousEmitter: closestSuspicious,
            isScanning: this.isScanning,
        };
    }

    public async startScanning(): Promise<boolean> {
        if (typeof window === 'undefined' || this.isScanning) return false;

        this.isScanning = true;
        this.notify();

        try {
            await BleClient.initialize();
            await BleClient.requestLEScan({}, (result) => {
                this.processScanResult(result);
            });
        } catch (e) {
            console.warn('[RfSigintWatchdogEngine] BLE Native scan initialization error:', e);
        }

        return true;
    }

    public async stopScanning() {
        this.isScanning = false;
        try {
            await BleClient.stopLEScan();
        } catch {}
        this.notify();
    }

    private processScanResult(result: any) {
        if (!result || !result.device) return;

        const deviceId = result.device.deviceId || 'UNKNOWN_EMITTER';
        const name = result.device.name || result.localName;
        const rssi = result.rssi ?? -80;

        // Path Loss RSSI a distancia estimada en metros
        const measuredPower = -59;
        const n = 2.2;
        const rawDist = Math.pow(10, (measuredPower - rssi) / (10 * n));
        const estimatedDistanceMeters = Math.max(0.5, Math.min(100, Math.round(rawDist * 10) / 10));

        // Clasificación de tipo
        let type: EmitterType = 'UNKNOWN_BLE';
        let isSuspicious = false;

        const mfgData = result.manufacturerData;
        const serviceUuids = result.serviceData || result.uuids;

        if (name && (name.toLowerCase().includes('drone') || name.toLowerCase().includes('dji') || name.toLowerCase().includes('opendroneid') || name.toLowerCase().includes('remoteid'))) {
            type = 'OPEN_DRONE_ID';
            isSuspicious = true;
        } else if (serviceUuids && Object.keys(serviceUuids).some(k => k.toLowerCase().includes('fffa') || k.toLowerCase().includes('0000fffa'))) {
            // OpenDroneID ASTM F3411 Service UUID 0xFFFA
            type = 'OPEN_DRONE_ID';
            isSuspicious = true;
        } else if (name && (name.toLowerCase().includes('airtag') || name.toLowerCase().includes('smarttag') || name.toLowerCase().includes('tile'))) {
            type = 'APPLE_FIND_MY';
            isSuspicious = true;
        } else if (mfgData && (mfgData['76'] || mfgData['0x004c'] || mfgData['004c'])) {
            // Apple Manufacturer ID 0x004C (AirTag / Find My network beacon)
            type = 'APPLE_FIND_MY';
            isSuspicious = true;
        } else if (name && name.toLowerCase().startsWith('red-')) {
            type = 'MESH_PEER';
            isSuspicious = false;
        }

        const now = Date.now();
        const existing = this.emitters.get(deviceId);

        if (existing) {
            existing.rssi = rssi;
            existing.estimatedDistanceMeters = estimatedDistanceMeters;
            existing.lastSeen = now;
            if (name) existing.name = name;
        } else {
            this.emitters.set(deviceId, {
                deviceId,
                name,
                rssi,
                estimatedDistanceMeters,
                type,
                firstSeen: now,
                lastSeen: now,
                isSuspicious,
            });
        }

        // Evicción periódica de emisores obsoletos (> 10 minutos)
        if (this.emitters.size > 200) {
            for (const [id, em] of this.emitters.entries()) {
                if (now - em.lastSeen > 600000) {
                    this.emitters.delete(id);
                }
            }
        }

        this.notify();
    }

    public getEmitters(): DetectedEmitter[] {
        return Array.from(this.emitters.values()).sort((a, b) => b.lastSeen - a.lastSeen);
    }

    public destroy(): void {
        this.stopScanning().catch(() => {});
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        this.emitters.clear();
        this.listeners.clear();
        RfSigintWatchdogEngine.instance = null;
    }
}

export const rfSigintWatchdog = RfSigintWatchdogEngine.getInstance();

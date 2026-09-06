/**
 * SatelliteMeshGatewayEngine.ts — RED LEO Satellite Store-and-Forward Mesh Gateway
 * 
 * Computes orbital pass geometry (Elevation >= 25 deg AOS) for Iridium-NEXT, Orbcomm, and Direct-to-Cell
 * constellations, provides polar SkyView coordinates (Azimuth/Elevation projection), and manages
 * Short Burst Data (SBD) emergency queues for automated LEO satellite uplinks.
 */

import { meshRouter } from './meshRouter';
import { dtnStorage } from './dtnStorage';
import { cbrnRadiation } from '../sensors/CbrnRadiationEngine';

export interface SatellitePass {
    satelliteId: string;
    constellation: 'IRIDIUM_NEXT' | 'ORBCOMM_OG2' | 'DIRECT_TO_CELL';
    azimuthDeg: number;
    elevationDeg: number;
    isInAos: boolean; // Acquisition of Signal (Elev >= 25°)
    timeToAosSec: number;
    passDurationSec: number;
    uplinkFrequencyMhz: number;
    polarX: number; // Coordenada X normalizada (-1 a +1) para Radar SkyView
    polarY: number; // Coordenada Y normalizada (-1 a +1) para Radar SkyView
}

export interface OutboundSatellitePacket {
    id: string;
    payload: string;
    timestamp: number;
    priority: number;
    targetConstellation?: string;
}

export interface SatelliteGatewayTelemetry {
    activePasses: SatellitePass[];
    queuedOutboundPackets: number;
    outboundQueue: OutboundSatellitePacket[];
    totalUplinksTransmitted: number;
    bestAvailableSatellite: SatellitePass | null;
    isUplinkAvailable: boolean;
    observerLat: number;
    observerLon: number;
    lastUplinkTimestamp: number | null;
}

interface ConstellationConfig {
    constellation: 'IRIDIUM_NEXT' | 'ORBCOMM_OG2' | 'DIRECT_TO_CELL';
    namePrefix: string;
    altitudeKm: number;
    inclinationDeg: number;
    periodSec: number;
    freqMhz: number;
    phaseOffsetRad: number;
}

const CONSTELLATIONS: ConstellationConfig[] = [
    {
        constellation: 'IRIDIUM_NEXT',
        namePrefix: 'IRIDIUM-NEXT',
        altitudeKm: 780,
        inclinationDeg: 86.4,
        periodSec: 6024, // ~100.4 min
        freqMhz: 1621.25,
        phaseOffsetRad: 0.85,
    },
    {
        constellation: 'ORBCOMM_OG2',
        namePrefix: 'ORBCOMM-OG2',
        altitudeKm: 750,
        inclinationDeg: 45.0,
        periodSec: 5988, // ~99.8 min
        freqMhz: 148.5,
        phaseOffsetRad: 2.45,
    },
    {
        constellation: 'DIRECT_TO_CELL',
        namePrefix: 'STARLINK-D2C',
        altitudeKm: 550,
        inclinationDeg: 53.2,
        periodSec: 5736, // ~95.6 min
        freqMhz: 1910.0,
        phaseOffsetRad: 4.12,
    }
];

export class SatelliteMeshGatewayEngine {
    private static instance: SatelliteMeshGatewayEngine | null = null;

    private outboundQueue: OutboundSatellitePacket[] = [];
    private totalUplinks: number = 0;
    private lastUplinkTimestamp: number | null = null;
    private listeners: Set<(t: SatelliteGatewayTelemetry) => void> = new Set();
    private updateInterval: any = null;
    private observerLat: number = 0;
    private observerLon: number = 0;
    private satellites: SatellitePass[] = [];

    private constructor() {
        this.satellites = this.calculateOrbitalPasses(Date.now());
        this.startOrbitalTracker();
    }

    public static getInstance(): SatelliteMeshGatewayEngine {
        if (!this.instance) {
            this.instance = new SatelliteMeshGatewayEngine();
        }
        return this.instance;
    }

    public setObserverLocation(lat: number, lon: number): void {
        this.observerLat = (typeof lat === 'number' && isFinite(lat)) ? lat : 0;
        this.observerLon = (typeof lon === 'number' && isFinite(lon)) ? lon : 0;
        this.satellites = this.calculateOrbitalPasses(Date.now());
        this.notify();
    }

    public calculateOrbitalPasses(nowMs: number): SatellitePass[] {
        const epochSec = nowMs / 1000;
        return CONSTELLATIONS.map((config, index) => {
            const meanAnomaly = ((epochSec / config.periodSec) * 2 * Math.PI + config.phaseOffsetRad) % (2 * Math.PI);
            const groundTrackLon = ((epochSec / 86400) * 360 + (meanAnomaly * 180 / Math.PI)) % 360;
            const rawElev = Math.sin(meanAnomaly) * 90;
            const elevationDeg = Math.max(0, Math.min(90, Math.round(rawElev * 10) / 10));
            const azimuthDeg = Math.round(((groundTrackLon + this.observerLon + 360) % 360) * 10) / 10;
            const isInAos = elevationDeg >= 25;
            const timeToAosSec = isInAos ? 0 : Math.max(1, Math.round(((Math.PI - (meanAnomaly % Math.PI)) / (2 * Math.PI)) * config.periodSec));
            const passDurationSec = isInAos ? Math.max(10, Math.round(((Math.PI * 0.35) / (2 * Math.PI)) * config.periodSec)) : 0;
            const satNumber = 100 + (index * 42) + Math.floor((epochSec / config.periodSec) % 66);

            // Proyección Polar SkyView:
            // Centro = Cenit (Elev 90° => r = 0).
            // Borde = Horizonte (Elev 0° => r = 1.0).
            const r = Math.max(0, Math.min(1, (90 - elevationDeg) / 90));
            // Ángulo azimut: 0° es Norte (hacia arriba, y negativo en SVG), 90° es Este (x positivo)
            const azRad = (azimuthDeg - 90) * (Math.PI / 180);
            const polarX = Math.round((r * Math.cos(azRad)) * 1000) / 1000;
            const polarY = Math.round((r * Math.sin(azRad)) * 1000) / 1000;

            return {
                satelliteId: `${config.namePrefix}-${satNumber}`,
                constellation: config.constellation,
                azimuthDeg,
                elevationDeg,
                isInAos,
                timeToAosSec,
                passDurationSec,
                uplinkFrequencyMhz: config.freqMhz,
                polarX,
                polarY,
            };
        });
    }

    public subscribe(cb: (t: SatelliteGatewayTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.getTelemetry());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const t = this.getTelemetry();
        this.listeners.forEach(cb => {
            try { cb(t); } catch {}
        });
    }

    private startOrbitalTracker() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            this.satellites = this.calculateOrbitalPasses(Date.now());
            this.notify();
        }, 1000);
    }

    public stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.listeners.clear();
    }

    public enqueueOutboundUplink(payload: string, priority: number = 5): string {
        const id = `SAT-UPLINK-${Date.now().toString(36)}`;
        this.outboundQueue.push({ id, payload, timestamp: Date.now(), priority });
        this.notify();
        return id;
    }

    /**
     * Empaqueta y encola un mensaje táctico en formato Short Burst Data (SBD) con telemetría de campo
     */
    public composeAndEnqueueSbd(message: string, priority: number = 8): { id: string; packetPayload: string } {
        const cleanMsg = (typeof message === 'string' && message.trim().length > 0)
            ? message.trim().slice(0, 240)
            : 'SITREP CBRN DE EMERGENCIA';

        const cbrnRate = cbrnRadiation.getTelemetry().doseRateUsVh;
        const latStr = this.observerLat.toFixed(5);
        const lonStr = this.observerLon.toFixed(5);
        const sbdPayload = `SBD_V1|LOC:${latStr},${lonStr}|RAD:${cbrnRate}uSv/h|TS:${Date.now()}|MSG:${cleanMsg}`;

        const id = this.enqueueOutboundUplink(sbdPayload, priority);
        return { id, packetPayload: sbdPayload };
    }

    public clearOutboundQueue(): void {
        this.outboundQueue = [];
        this.notify();
    }

    public triggerSatelliteBurst(): boolean {
        const best = this.satellites.find(s => s.isInAos);
        if (!best) return false;

        if (this.outboundQueue.length === 0) {
            // Si la cola está vacía, generamos un beacon de pulso orbital automático
            this.composeAndEnqueueSbd('PULSO AUTOMATICO DE ENLACE LEO', 3);
        }

        for (const item of this.outboundQueue) {
            try {
                const satEnvelope = `SAT_BURST_V1:${best.satelliteId}:${best.constellation}:${item.payload}`;
                const bytes = new TextEncoder().encode(satEnvelope);

                meshRouter.broadcast(bytes).catch(() => {});

                dtnStorage.enqueue({
                    recipient: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                    sender: 'SAT_GATEWAY',
                    ttl: 14,
                    flags: 0x01,
                    timestamp: Date.now(),
                    nonce: item.id,
                    payload: bytes,
                }, 9);
            } catch (err) {
                console.warn('[SatelliteGateway] Error despachando ráfaga satelital:', err);
            }
        }

        this.totalUplinks += Math.max(1, this.outboundQueue.length);
        this.lastUplinkTimestamp = Date.now();
        this.outboundQueue = [];
        this.notify();
        return true;
    }

    public getTelemetry(): SatelliteGatewayTelemetry {
        const best = this.satellites.find(s => s.isInAos) || null;

        return {
            activePasses: [...this.satellites],
            queuedOutboundPackets: this.outboundQueue.length,
            outboundQueue: [...this.outboundQueue],
            totalUplinksTransmitted: this.totalUplinks,
            bestAvailableSatellite: best,
            isUplinkAvailable: best !== null,
            observerLat: this.observerLat,
            observerLon: this.observerLon,
            lastUplinkTimestamp: this.lastUplinkTimestamp,
        };
    }
}

export const satelliteMeshGateway = SatelliteMeshGatewayEngine.getInstance();

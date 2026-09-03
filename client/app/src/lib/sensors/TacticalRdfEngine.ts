/**
 * TacticalRdfEngine.ts — RED Tactical Radio Direction Finding (RDF) & Signal Foxhunting Engine
 * 
 * Correlates real-time RSSI signal strength with magnetic compass azimuth heading
 * to construct a 360° polar radiation pattern and calculate the Line-of-Bearing (LOB) to clandestine RF transmitters.
 */

export type TargetSignalType = 'EMERGENCY_BEACON' | 'CLANDESTINE_TRANSMITTER' | 'ROGUE_JAMMER' | 'DRONE_UAV_LINK';

export interface RdfSample {
    headingDeg: number;
    rssiDbm: number;
    timestamp: number;
}

export interface PolarSector {
    sectorIndex: number;
    startAngleDeg: number;
    endAngleDeg: number;
    averageRssiDbm: number;
    sampleCount: number;
}

export interface PeakBearingInfo {
    peakHeadingDeg: number;
    peakRssiDbm: number;
    estimatedDistMeters: number;
    confidencePct: number;
    isSignalLocked: boolean;
}

export interface TacticalRdfState {
    currentHeading: number;
    currentRssi: number;
    targetType: TargetSignalType;
    sectors: PolarSector[];
    peakBearing: PeakBearingInfo;
    sampleCount: number;
}

export class TacticalRdfEngine {
    private static instance: TacticalRdfEngine | null = null;

    private static readonly SECTOR_COUNT = 16; // 16 sectores de 22.5°
    private static readonly SECTOR_WIDTH = 360 / TacticalRdfEngine.SECTOR_COUNT;

    private samples: RdfSample[] = [];
    private sectors: PolarSector[] = [];
    private currentHeading: number = 0;
    private currentRssi: number = -75;
    private targetType: TargetSignalType = 'EMERGENCY_BEACON';

    private listeners: Set<(state: TacticalRdfState) => void> = new Set();

    private constructor() {
        this.resetSectors();
    }

    public static getInstance(): TacticalRdfEngine {
        if (!this.instance) {
            this.instance = new TacticalRdfEngine();
        }
        return this.instance;
    }

    private resetSectors() {
        this.sectors = Array.from({ length: TacticalRdfEngine.SECTOR_COUNT }, (_, i) => ({
            sectorIndex: i,
            startAngleDeg: i * TacticalRdfEngine.SECTOR_WIDTH,
            endAngleDeg: (i + 1) * TacticalRdfEngine.SECTOR_WIDTH,
            averageRssiDbm: -105, // Ruido de fondo basal
            sampleCount: 0
        }));
    }

    public subscribe(cb: (state: TacticalRdfState) => void): () => void {
        this.listeners.add(cb);
        cb(this.getState());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const s = this.getState();
        this.listeners.forEach(cb => {
            try { cb(s); } catch {}
        });
    }

    public recordSample(headingDeg: number, rssiDbm: number) {
        const safeHeading = (typeof headingDeg === 'number' && isFinite(headingDeg))
            ? ((Math.round(headingDeg) % 360) + 360) % 360
            : 0;
        const safeRssi = (typeof rssiDbm === 'number' && isFinite(rssiDbm))
            ? Math.max(-140, Math.min(0, rssiDbm))
            : -105;

        this.currentHeading = safeHeading;
        this.currentRssi = safeRssi;

        const normalizedHeading = (this.currentHeading + 360) % 360;
        const sectorIndex = Math.floor(normalizedHeading / TacticalRdfEngine.SECTOR_WIDTH) % TacticalRdfEngine.SECTOR_COUNT;

        const sector = this.sectors[sectorIndex];
        if (sector) {
            if (sector.sampleCount === 0) {
                sector.averageRssiDbm = safeRssi;
            } else {
                sector.averageRssiDbm = Math.round((sector.averageRssiDbm * 0.7 + safeRssi * 0.3) * 10) / 10;
            }
            sector.sampleCount++;
        }

        this.samples.push({
            headingDeg: this.currentHeading,
            rssiDbm: safeRssi,
            timestamp: Date.now()
        });

        if (this.samples.length > 200) {
            this.samples.shift();
        }

        this.notify();
    }

    public getPeakBearing(): PeakBearingInfo {
        if (this.samples.length === 0) {
            return {
                peakHeadingDeg: 0,
                peakRssiDbm: -105,
                estimatedDistMeters: 0,
                confidencePct: 0,
                isSignalLocked: false,
            };
        }

        let bestSector = this.sectors[0];
        let totalSamples = 0;
        for (const s of this.sectors) {
            totalSamples += s.sampleCount;
            if (s.averageRssiDbm > bestSector.averageRssiDbm) {
                bestSector = s;
            }
        }

        const peakHeadingDeg = Math.round(bestSector.startAngleDeg + TacticalRdfEngine.SECTOR_WIDTH / 2);
        const peakRssiDbm = bestSector.averageRssiDbm;
        const isSignalLocked = bestSector.sampleCount >= 2 && peakRssiDbm > -95;

        // Log-Distance Path Loss Model (RSSI0 = -40 dBm a 1 metro, path loss exponent n = 2.5)
        const rssi0 = -40;
        const pathLossExponent = 2.5;
        const rawDist = Math.pow(10, (rssi0 - peakRssiDbm) / (10 * pathLossExponent));
        const safeDist = isFinite(rawDist) ? Math.max(1, Math.min(500, Math.round(rawDist * 10) / 10)) : 0;
        const rawConfidence = (Math.min(totalSamples, 20) / 20) * 60 + ((peakRssiDbm + 105) / 65) * 40;
        const confidencePct = isFinite(rawConfidence) ? Math.max(0, Math.min(100, Math.round(rawConfidence))) : 0;

        return {
            peakHeadingDeg,
            peakRssiDbm,
            estimatedDistMeters: isSignalLocked ? safeDist : 0,
            confidencePct: isSignalLocked ? confidencePct : 0,
            isSignalLocked,
        };
    }

    public setTargetType(type: TargetSignalType) {
        this.targetType = type;
        this.notify();
    }

    public clearData() {
        this.samples = [];
        this.resetSectors();
        this.notify();
    }

    public getState(): TacticalRdfState {
        return {
            currentHeading: this.currentHeading,
            currentRssi: this.currentRssi,
            targetType: this.targetType,
            sectors: this.sectors,
            peakBearing: this.getPeakBearing(),
            sampleCount: this.samples.length
        };
    }

    public destroy(): void {
        this.samples = [];
        this.resetSectors();
        this.listeners.clear();
        TacticalRdfEngine.instance = null;
    }
}

export const tacticalRdf = TacticalRdfEngine.getInstance();

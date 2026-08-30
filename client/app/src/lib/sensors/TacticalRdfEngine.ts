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

export class TacticalRdfEngine {
    private static instance: TacticalRdfEngine | null = null;

    private static readonly SECTOR_COUNT = 16; // 16 sectores de 22.5°
    private static readonly SECTOR_WIDTH = 360 / TacticalRdfEngine.SECTOR_COUNT;

    private samples: RdfSample[] = [];
    private sectors: PolarSector[] = [];
    private currentHeading: number = 0;
    private currentRssi: number = -75;
    private targetType: TargetSignalType = 'EMERGENCY_BEACON';

    private listeners: Set<(state: any) => void> = new Set();

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

    public subscribe(cb: (state: any) => void): () => void {
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
        this.currentHeading = Math.round(headingDeg) % 360;
        this.currentRssi = rssiDbm;

        const normalizedHeading = (this.currentHeading + 360) % 360;
        const sectorIndex = Math.floor(normalizedHeading / TacticalRdfEngine.SECTOR_WIDTH) % TacticalRdfEngine.SECTOR_COUNT;

        const sector = this.sectors[sectorIndex];
        if (sector) {
            if (sector.sampleCount === 0) {
                sector.averageRssiDbm = rssiDbm;
            } else {
                sector.averageRssiDbm = Math.round((sector.averageRssiDbm * 0.7 + rssiDbm * 0.3) * 10) / 10;
            }
            sector.sampleCount++;
        }

        this.samples.push({
            headingDeg: this.currentHeading,
            rssiDbm,
            timestamp: Date.now()
        });

        if (this.samples.length > 200) {
            this.samples.shift();
        }

        this.notify();
    }

    public getPeakBearing(): {
        peakHeadingDeg: number;
        peakRssiDbm: number;
        estimatedDistMeters: number;
        confidencePct: number;
        isSignalLocked: boolean;
    } {
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
        const dist = Math.pow(10, (rssi0 - peakRssiDbm) / (10 * pathLossExponent));
        const confidencePct = Math.min(100, Math.round((Math.min(totalSamples, 20) / 20) * 60 + ((peakRssiDbm + 105) / 65) * 40));

        return {
            peakHeadingDeg,
            peakRssiDbm,
            estimatedDistMeters: isSignalLocked ? Math.max(1, Math.min(500, Math.round(dist * 10) / 10)) : 0,
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

    public getState() {
        return {
            currentHeading: this.currentHeading,
            currentRssi: this.currentRssi,
            targetType: this.targetType,
            sectors: this.sectors,
            peakBearing: this.getPeakBearing(),
            sampleCount: this.samples.length
        };
    }
}

export const tacticalRdf = TacticalRdfEngine.getInstance();

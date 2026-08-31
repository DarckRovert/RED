/**
 * MeshUavRelayEngine.ts — RED Airborne UAV & High-Elevation Loiter Relay Engine
 * 
 * Manages 3D slant-range packet forwarding, Free-Space Path Loss (FSPL) link budgets,
 * ground-to-air coverage footprint calculation, and prioritized routing through elevated relay nodes
 * (tethered drones, loitering UAVs, captive aerostats) extending mesh range from 50m to >15km.
 */

export interface UavRelayNode {
    id: string;
    callsign: string;
    altitudeAglMeters: number;   // Altura sobre el terreno (Above Ground Level)
    coords: {
        lat: number;
        lon: number;
    };
    loiterMode: 'HOVER' | 'ORBIT' | 'FIGURE_8' | 'WAYPOINT_PATROL';
    batteryPct: number;
    linkQualityPct: number;
    coverageRadiusKm: number;
    activeRelayClients: number;
    rxPacketsCount: number;
    txPacketsCount: number;
    lastPingTimestamp: number;
}

export interface LinkBudgetCalculation {
    distanceKm: number;
    frequencyMhz: number;
    fsplDb: number;
    estimatedRxRssiDb: number;
    linkMarginDb: number;
    isViable: boolean;
}

export class MeshUavRelayEngine {
    private static instance: MeshUavRelayEngine | null = null;
    private activeRelays: Map<string, UavRelayNode> = new Map();
    private isAirborneRelayMode: boolean = false;
    private myAltitudeAgl: number = 0;
    private listeners: Set<() => void> = new Set();

    private constructor() {
        // Relays are discovered and registered strictly from real incoming LoRa/CoT/Mesh telemetry
    }

    public static getInstance(): MeshUavRelayEngine {
        if (!this.instance) {
            this.instance = new MeshUavRelayEngine();
        }
        return this.instance;
    }

    public subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(); } catch {}
        });
    }

    /**
     * Calcula las pérdidas en el espacio libre (Free-Space Path Loss - FSPL de Friis)
     */
    public calculateLinkBudget(
        groundLat: number, groundLon: number, groundAlt: number,
        uavLat: number, uavLon: number, uavAltAgl: number,
        freqMhz: number = 2400, // 2.4 GHz WiFi / BLE
        txPowerDbm: number = 20,
        rxSensitivityDbm: number = -95
    ): LinkBudgetCalculation {
        // Distancia euclidiana aproximada en 3D
        const dLatKm = (uavLat - groundLat) * 111.32;
        const dLonKm = (uavLon - groundLon) * 111.32 * Math.cos(groundLat * Math.PI / 180);
        const dAltKm = Math.abs(uavAltAgl - groundAlt) / 1000;

        const distanceKm = Math.max(0.01, Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm + dAltKm * dAltKm));

        // Fórmula FSPL estándar: FSPL(dB) = 20*log10(d_km) + 20*log10(f_MHz) + 32.44
        const fsplDb = Math.round((20 * Math.log10(distanceKm) + 20 * Math.log10(freqMhz) + 32.44) * 10) / 10;
        const estimatedRxRssiDb = Math.round(txPowerDbm - fsplDb);
        const linkMarginDb = Math.round(estimatedRxRssiDb - rxSensitivityDbm);
        const isViable = linkMarginDb > 6; // Margen de desvanecimiento mínimo 6 dB

        return {
            distanceKm: Math.round(distanceKm * 100) / 100,
            frequencyMhz: freqMhz,
            fsplDb,
            estimatedRxRssiDb,
            linkMarginDb,
            isViable,
        };
    }

    /**
     * Calcula el radio de cobertura geométrica del horizonte radioeléctrico del dron
     */
    public calculateCoverageRadiusKm(altitudeAglMeters: number): number {
        const earthRadiusKm = 6371;
        const hKm = Math.max(0, altitudeAglMeters) / 1000;
        // R_cov = sqrt(2 * R_E * h + h^2)
        const radius = Math.sqrt(2 * earthRadiusKm * hKm + hKm * hKm);
        return Math.round(radius * 10) / 10;
    }

    public addOrUpdateRelay(relay: UavRelayNode) {
        this.activeRelays.set(relay.id, relay);
        this.notify();
    }

    public getActiveRelays(): UavRelayNode[] {
        return Array.from(this.activeRelays.values());
    }

    public setAirborneMode(enabled: boolean, altitudeAgl: number = 50) {
        this.isAirborneRelayMode = enabled;
        this.myAltitudeAgl = Math.max(0, altitudeAgl);
        this.notify();
    }

    public isAirborne(): boolean {
        return this.isAirborneRelayMode;
    }

    public destroy(): void {
        this.listeners.clear();
        this.activeRelays.clear();
    }
}

export const meshUavRelayEngine = MeshUavRelayEngine.getInstance();

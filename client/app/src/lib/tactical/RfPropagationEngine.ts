/**
 * RfPropagationEngine.ts — RED Sovereign Tactical Radio Frequency Engine (v106.0.0)
 *
 * Implements ITU-R P.526 / DoD RF Line-of-Sight (LoS) and 1st Fresnel Zone clearance
 * calculations for LoRa tactical mesh radios (433 MHz, 868 MHz, 915 MHz, 2.4 GHz).
 * Models Earth curvature with 4/3 effective atmospheric refraction, Free Space Path Loss (FSPL),
 * knife-edge diffraction losses, and link budget margins for Semtech SX1262 hardware.
 */

export interface GeoPoint {
    lat: number;
    lon: number;
    altMeters: number;        // Ground elevation above sea level
    antennaHeightMeters?: number; // Default: 2m for handheld, 10m for mast/repeater
}

export type LinkStatus = 'CLEAR_LOS' | 'PARTIAL_DIFFRACTION' | 'OBSTRUCTED_NLOS';

export interface ProfileSample {
    distanceKm: number;
    terrainAltMeters: number;
    earthBulgeMeters: number;
    totalObstacleAltMeters: number;
    losAltMeters: number;
    fresnelRadiusMeters: number;
    clearanceMeters: number;
    fresnelRatio: number; // clearance / fresnelRadius (>= 0.6 is clear)
    isObstructed: boolean;
}

export interface RfLinkAnalysis {
    totalDistanceKm: number;
    frequencyMhz: number;
    txPowerDbm: number;
    rxSensitivityDbm: number;
    fsplDb: number;
    diffractionLossDb: number;
    estimatedRxPowerDbm: number;
    fadeMarginDb: number;
    status: LinkStatus;
    minClearanceRatio: number;
    criticalObstacleIndex: number;
    recommendedTxAntennaHeightMeters: number;
    samples: ProfileSample[];
}

export class RfPropagationEngine {
    private static instance: RfPropagationEngine | null = null;

    // Constants
    public static readonly EARTH_RADIUS_METERS = 6371000;
    public static readonly K_FACTOR_REFRACTION = 1.3333; // 4/3 standard Earth model
    public static readonly DEFAULT_SX1262_SENSITIVITY = -137; // dBm @ SF12 / 125 kHz
    public static readonly DEFAULT_TX_POWER = 22; // dBm (max SX1262)
    public static readonly DEFAULT_ANTENNA_GAIN_DBI = 2.15; // standard dipole

    private constructor() {}

    public static getInstance(): RfPropagationEngine {
        if (!this.instance) {
            this.instance = new RfPropagationEngine();
        }
        return this.instance;
    }

    /**
     * Calculates great-circle distance between two coordinates in kilometers (Haversine)
     */
    public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 1000) / 1000;
    }

    /**
     * Calculates the radius of the 1st Fresnel Zone in meters
     * R1 = 17.32 * sqrt((d1 * d2) / (f_GHz * (d1 + d2)))
     * @param d1Km Distance from transmitter in km
     * @param d2Km Distance from receiver in km
     * @param freqMhz Frequency in MHz (e.g. 915)
     */
    public calculateFresnelRadiusMeters(d1Km: number, d2Km: number, freqMhz: number): number {
        const totalDistKm = d1Km + d2Km;
        if (totalDistKm <= 0 || freqMhz <= 0) return 0;
        const freqGhz = freqMhz / 1000;
        const product = (d1Km * d2Km) / (freqGhz * totalDistKm);
        return Math.round(17.32 * Math.sqrt(Math.max(0, product)) * 100) / 100;
    }

    /**
     * Calculates the Earth curvature bulge in meters with 4/3 atmospheric refraction
     * h_bulge = (d1_m * d2_m) / (2 * R_eff)
     */
    public calculateEarthBulgeMeters(d1Km: number, d2Km: number): number {
        const d1Meters = d1Km * 1000;
        const d2Meters = d2Km * 1000;
        const effectiveRadius = RfPropagationEngine.EARTH_RADIUS_METERS * RfPropagationEngine.K_FACTOR_REFRACTION;
        return (d1Meters * d2Meters) / (2 * effectiveRadius);
    }

    /**
     * Calculates Free Space Path Loss (FSPL) in dB
     * FSPL = 20 * log10(d_km) + 20 * log10(f_MHz) + 32.44
     */
    public calculateFsplDb(distKm: number, freqMhz: number): number {
        if (distKm <= 0.001) return 0;
        const fspl = 20 * Math.log10(distKm) + 20 * Math.log10(freqMhz) + 32.44;
        return Math.round(fspl * 10) / 10;
    }

    /**
     * Analyzes RF Line of Sight and Fresnel clearance between two points given a terrain elevation slice
     */
    public analyzeLink(
        tx: GeoPoint,
        rx: GeoPoint,
        terrainElevations: number[], // Elevation samples from TX to RX
        frequencyMhz = 915.0,
        txPowerDbm = RfPropagationEngine.DEFAULT_TX_POWER,
        rxSensitivityDbm = RfPropagationEngine.DEFAULT_SX1262_SENSITIVITY
    ): RfLinkAnalysis {
        const totalDistanceKm = this.calculateDistanceKm(tx.lat, tx.lon, rx.lat, rx.lon);
        const numSamples = Math.max(2, terrainElevations.length);
        const stepKm = totalDistanceKm / (numSamples - 1);

        const txAntenna = tx.antennaHeightMeters ?? 2.0;
        const rxAntenna = rx.antennaHeightMeters ?? 2.0;
        const txAbsoluteAlt = tx.altMeters + txAntenna;
        const rxAbsoluteAlt = rx.altMeters + rxAntenna;

        const samples: ProfileSample[] = [];
        let minClearanceRatio = 999.0;
        let criticalObstacleIndex = 0;
        let maxObstructionDepth = 0;

        for (let i = 0; i < numSamples; i++) {
            const d1Km = i * stepKm;
            const d2Km = totalDistanceKm - d1Km;
            const fraction = numSamples > 1 ? i / (numSamples - 1) : 0;

            const losAltMeters = txAbsoluteAlt + fraction * (rxAbsoluteAlt - txAbsoluteAlt);
            const earthBulgeMeters = this.calculateEarthBulgeMeters(d1Km, d2Km);
            const terrainAltMeters = terrainElevations[i] ?? 0;
            const totalObstacleAltMeters = terrainAltMeters + earthBulgeMeters;

            const fresnelRadiusMeters = this.calculateFresnelRadiusMeters(d1Km, d2Km, frequencyMhz);
            const clearanceMeters = losAltMeters - totalObstacleAltMeters;

            const fresnelRatio = fresnelRadiusMeters > 0
                ? clearanceMeters / fresnelRadiusMeters
                : (clearanceMeters > 0 ? 1.0 : -1.0);

            const isObstructed = clearanceMeters < 0;

            if (fresnelRatio < minClearanceRatio) {
                minClearanceRatio = fresnelRatio;
                criticalObstacleIndex = i;
            }

            if (-clearanceMeters > maxObstructionDepth) {
                maxObstructionDepth = -clearanceMeters;
            }

            samples.push({
                distanceKm: Math.round(d1Km * 100) / 100,
                terrainAltMeters: Math.round(terrainAltMeters * 10) / 10,
                earthBulgeMeters: Math.round(earthBulgeMeters * 10) / 10,
                totalObstacleAltMeters: Math.round(totalObstacleAltMeters * 10) / 10,
                losAltMeters: Math.round(losAltMeters * 10) / 10,
                fresnelRadiusMeters: Math.round(fresnelRadiusMeters * 10) / 10,
                clearanceMeters: Math.round(clearanceMeters * 10) / 10,
                fresnelRatio: Math.round(fresnelRatio * 100) / 100,
                isObstructed
            });
        }

        // Link Status determination
        let status: LinkStatus = 'CLEAR_LOS';
        let diffractionLossDb = 0;

        if (minClearanceRatio < 0) {
            status = 'OBSTRUCTED_NLOS';
            // Approximation of Knife-Edge diffraction loss in deep shadow
            diffractionLossDb = Math.min(45, Math.round(16 + 20 * Math.log10(Math.abs(minClearanceRatio) + 1)));
        } else if (minClearanceRatio < 0.6) {
            status = 'PARTIAL_DIFFRACTION';
            diffractionLossDb = Math.round((0.6 - minClearanceRatio) * 10 * 10) / 10;
        }

        const fsplDb = this.calculateFsplDb(totalDistanceKm, frequencyMhz);
        const totalGainDb = RfPropagationEngine.DEFAULT_ANTENNA_GAIN_DBI * 2;
        const estimatedRxPowerDbm = Math.round((txPowerDbm + totalGainDb - fsplDb - diffractionLossDb) * 10) / 10;
        const fadeMarginDb = Math.round((estimatedRxPowerDbm - rxSensitivityDbm) * 10) / 10;

        const recommendedTxAntennaHeightMeters = Math.max(
            txAntenna,
            Math.round((txAntenna + maxObstructionDepth + (samples[criticalObstacleIndex]?.fresnelRadiusMeters ?? 0) * 0.6) * 10) / 10
        );

        return {
            totalDistanceKm,
            frequencyMhz,
            txPowerDbm,
            rxSensitivityDbm,
            fsplDb,
            diffractionLossDb,
            estimatedRxPowerDbm,
            fadeMarginDb,
            status,
            minClearanceRatio: Math.round(minClearanceRatio * 100) / 100,
            criticalObstacleIndex,
            recommendedTxAntennaHeightMeters,
            samples
        };
    }

    /**
     * Generates a synthetic terrain profile between two points for offline evaluation when DEM is unavailable
     */
    public generateSyntheticProfile(startAlt: number, endAlt: number, numPoints = 50, roughness = 15): number[] {
        const profile: number[] = [];
        for (let i = 0; i < numPoints; i++) {
            const frac = i / (numPoints - 1);
            const linearAlt = startAlt + frac * (endAlt - startAlt);
            // Bell-curve hill simulator + pseudorandom roughness
            const hill = Math.sin(frac * Math.PI) * roughness;
            const jitter = ((Math.sin(i * 1.7) + Math.cos(i * 2.3)) / 2) * (roughness * 0.3);
            profile.push(Math.max(0, Math.round((linearAlt + hill + jitter) * 10) / 10));
        }
        return profile;
    }

    public destroy(): void {
        RfPropagationEngine.instance = null;
    }
}

export const rfPropagation = RfPropagationEngine.getInstance();

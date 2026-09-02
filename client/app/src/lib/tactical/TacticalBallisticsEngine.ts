/**
 * TacticalBallisticsEngine.ts — RED Off-Grid Tactical Ballistics & Mil-Dot Precision Engine
 * 
 * Computes trajectory bullet drop, crosswind deflection, cosine angle compensation (Rifleman's Rule),
 * and scope turret adjustments in MRAD (0.1 Mil clicks) and MOA (1/4 MOA clicks) for NATO standard calibers.
 */

export interface CaliberProfile {
    name: string;
    bulletMassGrams: number;
    ballisticCoefficientG1: number;
    muzzleVelocityMps: number;
    zeroRangeMeters: number;
}

export interface BallisticSolution {
    targetDistanceMeters: number;
    bulletDropCm: number;
    elevationMrad: number;
    elevationMoa: number;
    elevationClicksMrad: number; // 0.1 MRAD clicks
    elevationClicksMoa: number;  // 1/4 MOA clicks
    windDriftCm: number;
    windageMrad: number;
    windageMoa: number;
    timeOfFlightSec: number;
    remainingVelocityMps: number;
    kineticEnergyJoules: number;
}

export class TacticalBallisticsEngine {
    private static instance: TacticalBallisticsEngine | null = null;

    public static readonly PROFILES: Record<string, CaliberProfile> = {
        '5.56_NATO': {
            name: '5.56x45mm NATO (M855 62gr)',
            bulletMassGrams: 4.02,
            ballisticCoefficientG1: 0.304,
            muzzleVelocityMps: 940,
            zeroRangeMeters: 100,
        },
        '7.62_NATO': {
            name: '7.62x51mm NATO (.308 Win 168gr)',
            bulletMassGrams: 10.89,
            ballisticCoefficientG1: 0.462,
            muzzleVelocityMps: 800,
            zeroRangeMeters: 100,
        },
        '300_WINMAG': {
            name: '.300 Win Mag (190gr SMK)',
            bulletMassGrams: 12.31,
            ballisticCoefficientG1: 0.533,
            muzzleVelocityMps: 890,
            zeroRangeMeters: 100,
        },
        '338_LAPUA': {
            name: '.338 Lapua Mag (250gr Scenar)',
            bulletMassGrams: 16.20,
            ballisticCoefficientG1: 0.675,
            muzzleVelocityMps: 905,
            zeroRangeMeters: 100,
        },
        '9MM_LUGER': {
            name: '9x19mm NATO (124gr FMJ)',
            bulletMassGrams: 8.04,
            ballisticCoefficientG1: 0.160,
            muzzleVelocityMps: 360,
            zeroRangeMeters: 25,
        }
    };

    private constructor() {}

    public static getInstance(): TacticalBallisticsEngine {
        if (!this.instance) {
            this.instance = new TacticalBallisticsEngine();
        }
        return this.instance;
    }

    /**
     * Resuelve la ecuación balística simplificada de punto material
     */
    public calculateSolution(
        caliberKey: string,
        distanceMeters: number,
        crosswindMps: number = 0,
        inclineAngleDeg: number = 0
    ): BallisticSolution {
        const cal = TacticalBallisticsEngine.PROFILES[caliberKey] || TacticalBallisticsEngine.PROFILES['5.56_NATO'];
        const g = 9.80665;

        if (!isFinite(distanceMeters) || distanceMeters <= 0) {
            const initEnergy = Math.round(0.5 * (cal.bulletMassGrams / 1000) * Math.pow(cal.muzzleVelocityMps, 2));
            return {
                targetDistanceMeters: 0,
                bulletDropCm: 0,
                elevationMrad: 0,
                elevationMoa: 0,
                elevationClicksMrad: 0,
                elevationClicksMoa: 0,
                windDriftCm: 0,
                windageMrad: 0,
                windageMoa: 0,
                timeOfFlightSec: 0,
                remainingVelocityMps: cal.muzzleVelocityMps,
                kineticEnergyJoules: initEnergy,
            };
        }

        const safeDistance = Math.min(3000, Math.max(1, distanceMeters));
        const safeCrosswind = (typeof crosswindMps === 'number' && isFinite(crosswindMps)) ? crosswindMps : 0;
        const safeIncline = (typeof inclineAngleDeg === 'number' && isFinite(inclineAngleDeg))
            ? Math.max(-89, Math.min(89, inclineAngleDeg))
            : 0;

        const cosAngle = Math.cos((safeIncline * Math.PI) / 180);

        // Estimación de tiempo de vuelo con deceleración aerodinámica G1
        const avgVelocity = cal.muzzleVelocityMps * (1 - (0.00035 / Math.max(0.1, cal.ballisticCoefficientG1)) * (safeDistance / 2));
        const vMps = Math.max(150, avgVelocity);
        const timeOfFlightSec = safeDistance / vMps;

        // Caída por gravedad: drop = 0.5 * g * t^2
        const rawDropM = 0.5 * g * Math.pow(timeOfFlightSec, 2);
        const zeroDropM = 0.5 * g * Math.pow(cal.zeroRangeMeters / cal.muzzleVelocityMps, 2);
        const netDropM = Math.max(0, (rawDropM - (zeroDropM * (safeDistance / cal.zeroRangeMeters)))) * cosAngle;
        const bulletDropCm = Math.round(netDropM * 100 * 10) / 10;

        // Conversión a MRAD y MOA
        // 1 MRAD a D metros = D / 1000 metros = D * 0.1 cm
        const mradFactor = Math.max(0.1, safeDistance * 0.1);
        const elevationMrad = Math.round((bulletDropCm / mradFactor) * 10) / 10;
        const elevationMoa = Math.round((elevationMrad * 3.4377) * 10) / 10;

        // Deriva por viento: drift = crosswind * (t - (x / V0))
        const windDriftM = Math.abs(safeCrosswind) * Math.max(0, (timeOfFlightSec - (safeDistance / cal.muzzleVelocityMps)));
        const windDriftCm = Math.round(Math.max(0, windDriftM * 100) * 10) / 10;
        const windageMrad = Math.round((windDriftCm / mradFactor) * 10) / 10;
        const windageMoa = Math.round((windageMrad * 3.4377) * 10) / 10;

        // Velocidad y Energía residual
        const remainingVelocityMps = Math.round(cal.muzzleVelocityMps * Math.exp(-0.0003 * safeDistance / Math.max(0.01, cal.ballisticCoefficientG1)));
        const kineticEnergyJoules = Math.round(0.5 * (cal.bulletMassGrams / 1000) * Math.pow(remainingVelocityMps, 2));

        return {
            targetDistanceMeters: safeDistance,
            bulletDropCm,
            elevationMrad,
            elevationMoa,
            elevationClicksMrad: Math.round(elevationMrad * 10), // 0.1 Mil per click
            elevationClicksMoa: Math.round(elevationMoa * 4),   // 1/4 MOA per click
            windDriftCm,
            windageMrad,
            windageMoa,
            timeOfFlightSec: Math.round(timeOfFlightSec * 100) / 100,
            remainingVelocityMps,
            kineticEnergyJoules,
        };
    }

    public destroy(): void {
        TacticalBallisticsEngine.instance = null;
    }
}

export const tacticalBallistics = TacticalBallisticsEngine.getInstance();

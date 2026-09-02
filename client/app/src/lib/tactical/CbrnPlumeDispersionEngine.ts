/**
 * CbrnPlumeDispersionEngine.ts — RED CBRN Atmospheric Fallout & Toxic Plume Gaussian Dispersion Engine
 * 
 * Computes Pasquill-Gifford atmospheric dispersion hazard cones (Hot Zone, Warm Zone, Cold Zone)
 * driven by real-time barometric wind vectors, and mathematically generates the Optimal Safe Evacuation Vector
 * (90° crosswind/upwind escape corridor) preventing operators from fleeing directly downwind into lethal IDLH clouds.
 */

export type PasquillStabilityClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface CbrnIncidentSource {
    id: string;
    lat: number;
    lon: number;
    hazardType: 'RADIOACTIVE_FALLOUT' | 'CHLORINE_GAS' | 'AMMONIA_TOXIC' | 'SARIN_ORGANOPHOSPHATE' | 'INDUSTRIAL_SMOKE';
    releaseRateKgSec: number;
    windSpeedKmh: number;
    windDirectionDegrees: number; // Hacia dónde sopla el viento (0-360)
    stabilityClass: PasquillStabilityClass;
    timestamp: number;
}

export interface PlumeHazardZone {
    source: CbrnIncidentSource;
    hotZoneRadiusMeters: number;    // Zona Caliente (Letal inmediata / IDLH)
    warmZoneLengthMeters: number;   // Zona Tibia (Evacuación obligatoria)
    warmZoneWidthMeters: number;    // Ancho lateral de la pluma
    coldZonePerimeterMeters: number;// Perímetro Seguro
    escapeVector: {
        recommendedAzimuthDegrees: number; // Rumbo de escape en grados
        distanceToSafetyMeters: number;
        estimatedWalkTimeMinutes: number;
        isInDangerZone: boolean;
        currentDangerLevel: 'SAFE' | 'WARM_EXCLUSION' | 'HOT_LETHAL';
    };
}

export class CbrnPlumeDispersionEngine {
    private static instance: CbrnPlumeDispersionEngine | null = null;

    private constructor() {}

    public static getInstance(): CbrnPlumeDispersionEngine {
        if (!this.instance) {
            this.instance = new CbrnPlumeDispersionEngine();
        }
        return this.instance;
    }

    /**
     * Calcula la geometría de la pluma de dispersión y el vector de escape táctico
     */
    public calculatePlumeDispersion(
        source: CbrnIncidentSource,
        operatorLat: number,
        operatorLon: number
    ): PlumeHazardZone {
        const safeWindSpeed = (typeof source.windSpeedKmh === 'number' && isFinite(source.windSpeedKmh) && source.windSpeedKmh >= 0)
            ? source.windSpeedKmh
            : 15;
        const windMs = Math.max(1, safeWindSpeed / 3.6);

        // Parámetros de escala según severidad del agente
        let severityFactor = 1.0;
        switch (source.hazardType) {
            case 'RADIOACTIVE_FALLOUT': severityFactor = 2.5; break;
            case 'SARIN_ORGANOPHOSPHATE': severityFactor = 3.0; break;
            case 'CHLORINE_GAS': severityFactor = 1.8; break;
            case 'AMMONIA_TOXIC': severityFactor = 1.4; break;
            default: severityFactor = 1.0; break;
        }

        const hotZoneRadiusMeters = Math.round(150 * severityFactor);
        const warmZoneLengthMeters = Math.round((800 + (windMs * 250)) * severityFactor);
        const warmZoneWidthMeters = Math.round(warmZoneLengthMeters * 0.45);
        const coldZonePerimeterMeters = warmZoneLengthMeters + 300;

        const rawWindDir = typeof source.windDirectionDegrees === 'number' && isFinite(source.windDirectionDegrees)
            ? source.windDirectionDegrees
            : 0;
        const windDir = ((rawWindDir % 360) + 360) % 360;

        const areCoordsFinite = isFinite(operatorLat) && isFinite(operatorLon) && isFinite(source.lat) && isFinite(source.lon);
        if (!areCoordsFinite) {
            return {
                source,
                hotZoneRadiusMeters,
                warmZoneLengthMeters,
                warmZoneWidthMeters,
                coldZonePerimeterMeters,
                escapeVector: {
                    recommendedAzimuthDegrees: (windDir + 90) % 360,
                    distanceToSafetyMeters: 0,
                    estimatedWalkTimeMinutes: 0,
                    isInDangerZone: false,
                    currentDangerLevel: 'SAFE',
                }
            };
        }

        // Distancia y rumbo del operador respecto al foco emisor
        const dLat = (operatorLat - source.lat) * 111320;
        const dLon = (operatorLon - source.lon) * 111320 * Math.cos(source.lat * Math.PI / 180);
        const distanceToSource = Math.sqrt(dLat * dLat + dLon * dLon);

        let bearingFromSourceDeg = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

        // Diferencia angular con la dirección del viento
        const angleDiff = Math.abs(((bearingFromSourceDeg - windDir + 180) % 360) - 180);

        let currentDangerLevel: 'SAFE' | 'WARM_EXCLUSION' | 'HOT_LETHAL' = 'SAFE';
        let isInDangerZone = false;

        if (distanceToSource <= hotZoneRadiusMeters) {
            currentDangerLevel = 'HOT_LETHAL';
            isInDangerZone = true;
        } else if (distanceToSource <= warmZoneLengthMeters && angleDiff <= 35) {
            currentDangerLevel = 'WARM_EXCLUSION';
            isInDangerZone = true;
        }

        // Vector Óptimo de Escape:
        // Si estás en la pluma, la ruta más corta para salir es perpendicular al eje del viento (+90° o -90°)
        // apuntando hacia el costado más cercano
        const isRightOfPlumeCenter = ((bearingFromSourceDeg - windDir + 360) % 360) < 180;
        const escapeOffset = isRightOfPlumeCenter ? 90 : -90;
        const recommendedAzimuthDegrees = (windDir + escapeOffset + 360) % 360;

        // Distancia lateral para salir del cono
        const distanceToSafetyMeters = isInDangerZone
            ? Math.round(Math.max(100, (warmZoneWidthMeters / 2) + 50))
            : 0;

        const walkingSpeedMs = 1.38; // ~5 km/h
        const estimatedWalkTimeMinutes = Math.round((distanceToSafetyMeters / walkingSpeedMs) / 60);

        return {
            source,
            hotZoneRadiusMeters,
            warmZoneLengthMeters,
            warmZoneWidthMeters,
            coldZonePerimeterMeters,
            escapeVector: {
                recommendedAzimuthDegrees,
                distanceToSafetyMeters,
                estimatedWalkTimeMinutes,
                isInDangerZone,
                currentDangerLevel,
            }
        };
    }
}

export const cbrnPlumeDispersionEngine = CbrnPlumeDispersionEngine.getInstance();

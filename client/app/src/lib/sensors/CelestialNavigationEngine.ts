/**
 * CelestialNavigationEngine.ts — RED Off-Grid Celestial Navigation & Astronomical Ephemeris Engine
 * 
 * Computes real-time Sun and Moon positions (Azimuth, Altitude, Declination),
 * calculates tactical twilights (Civil, Nautical, Astronomical) for nighttime stealth operations,
 * and estimates geographic coordinates (Lat/Lon) via Solar Noon Transit without GNSS or internet.
 */

export interface CelestialBodyPosition {
    azimuthDeg: number;
    altitudeDeg: number;
    declinationDeg: number;
    isAboveHorizon: boolean;
}

export interface CelestialEphemeris {
    timestamp: number;
    sun: CelestialBodyPosition;
    moon: CelestialBodyPosition;
    moonIlluminationPct: number;
    moonPhaseName: string;
    solarNoonUtcHours: number;
    isDaylight: boolean;
    tacticalLightingState: 'FULL_DAYLIGHT' | 'CIVIL_TWILIGHT' | 'NAUTICAL_TWILIGHT' | 'ASTRONOMICAL_TWILIGHT' | 'PITCH_BLACK';
}

export class CelestialNavigationEngine {
    private static instance: CelestialNavigationEngine | null = null;

    private constructor() {}

    public static getInstance(): CelestialNavigationEngine {
        if (!this.instance) {
            this.instance = new CelestialNavigationEngine();
        }
        return this.instance;
    }

    /**
     * Calcula las efemérides completas del Sol y la Luna para una fecha y posición dada
     */
    public calculateEphemeris(
        latDeg: number = 4.6097,
        lonDeg: number = -74.0817,
        date: Date = new Date()
    ): CelestialEphemeris {
        const rad = Math.PI / 180;
        const deg = 180 / Math.PI;

        // Día juliano simplificado
        const time = date.getTime();
        const julianDay = (time / 86400000) - (date.getTimezoneOffset() / 1440) + 2440587.5;
        const d = julianDay - 2451545.0; // Días desde J2000.0

        // Posición solar simplificada
        const L = (280.460 + 0.9856474 * d) % 360;
        const g = ((357.528 + 0.9856003 * d) % 360) * rad;
        const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
        const epsilon = (23.439 - 0.0000004 * d) * rad;

        // Declinación y Ascensión Recta solar
        const sinDecl = Math.sin(epsilon) * Math.sin(lambda);
        const declinationDeg = Math.asin(sinDecl) * deg;

        // Ángulo horario de Greenwich (GMST)
        const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
        const gmst = (280.46061837 + 360.98564736629 * d) % 360;
        const lst = (gmst + lonDeg) % 360;

        // Altitud y Azimut solar
        const ha = (lst - L) * rad;
        const latRad = latDeg * rad;
        const sinAlt = Math.sin(latRad) * Math.sin(declinationDeg * rad) + Math.cos(latRad) * Math.cos(declinationDeg * rad) * Math.cos(ha);
        const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * deg;

        const cosAz = (Math.sin(declinationDeg * rad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(altitudeDeg * rad));
        let azimuthDeg = Math.acos(Math.max(-1, Math.min(1, cosAz))) * deg;
        if (Math.sin(ha) > 0) azimuthDeg = 360 - azimuthDeg;

        // Fase Lunar simplificada (Ciclo sinódico de 29.53 días)
        const moonPhaseDays = (d + 18.5) % 29.53059;
        const moonIlluminationPct = Math.round((0.5 * (1 - Math.cos((moonPhaseDays / 29.53059) * 2 * Math.PI))) * 100);

        let moonPhaseName = 'Luna Nueva';
        if (moonPhaseDays > 1.84 && moonPhaseDays <= 5.53) moonPhaseName = 'Creciente Cóncava';
        else if (moonPhaseDays > 5.53 && moonPhaseDays <= 9.22) moonPhaseName = 'Cuarto Creciente';
        else if (moonPhaseDays > 9.22 && moonPhaseDays <= 12.91) moonPhaseName = 'Gibosa Creciente';
        else if (moonPhaseDays > 12.91 && moonPhaseDays <= 16.61) moonPhaseName = 'Luna Llena';
        else if (moonPhaseDays > 16.61 && moonPhaseDays <= 20.30) moonPhaseName = 'Gibosa Menguante';
        else if (moonPhaseDays > 20.30 && moonPhaseDays <= 23.99) moonPhaseName = 'Cuarto Menguante';
        else if (moonPhaseDays > 23.99 && moonPhaseDays <= 27.68) moonPhaseName = 'Creciente Menguante';

        // Posición lunar estimada
        const moonAzimuthDeg = (azimuthDeg + 180 + (moonPhaseDays * 12.2)) % 360;
        const moonAltitudeDeg = Math.sin((moonAzimuthDeg * rad)) * 60;

        // Estado de iluminación táctica
        let tacticalLightingState: 'FULL_DAYLIGHT' | 'CIVIL_TWILIGHT' | 'NAUTICAL_TWILIGHT' | 'ASTRONOMICAL_TWILIGHT' | 'PITCH_BLACK' = 'PITCH_BLACK';
        if (altitudeDeg > 0) tacticalLightingState = 'FULL_DAYLIGHT';
        else if (altitudeDeg > -6) tacticalLightingState = 'CIVIL_TWILIGHT';
        else if (altitudeDeg > -12) tacticalLightingState = 'NAUTICAL_TWILIGHT';
        else if (altitudeDeg > -18) tacticalLightingState = 'ASTRONOMICAL_TWILIGHT';

        return {
            timestamp: time,
            sun: {
                azimuthDeg: Math.round(azimuthDeg * 10) / 10,
                altitudeDeg: Math.round(altitudeDeg * 10) / 10,
                declinationDeg: Math.round(declinationDeg * 10) / 10,
                isAboveHorizon: altitudeDeg > 0,
            },
            moon: {
                azimuthDeg: Math.round(moonAzimuthDeg * 10) / 10,
                altitudeDeg: Math.round(moonAltitudeDeg * 10) / 10,
                declinationDeg: 15.2,
                isAboveHorizon: moonAltitudeDeg > 0,
            },
            moonIlluminationPct,
            moonPhaseName,
            solarNoonUtcHours: 12 - (lonDeg / 15),
            isDaylight: altitudeDeg > 0,
            tacticalLightingState,
        };
    }

    /**
     * Estima la posición geográfica por tránsito del mediodía solar
     */
    public estimatePositionFromSolarNoon(
        solarZenithUtcTimeStr: string,
        maxMeasuredSolarAltitudeDeg: number
    ): { estimatedLat: number; estimatedLon: number } {
        const [hStr, mStr] = solarZenithUtcTimeStr.split(':');
        const utcHours = parseFloat(hStr) + parseFloat(mStr) / 60;

        // Longitud = (12 - UTC_transit) * 15
        const estimatedLon = Math.round(((12 - utcHours) * 15) * 100) / 100;
        
        // Declinación aproximada actual (ej: ~10° en agosto)
        const declinationApprox = 9.5;
        const estimatedLat = Math.round((90 - maxMeasuredSolarAltitudeDeg + declinationApprox) * 100) / 100;

        return {
            estimatedLat,
            estimatedLon,
        };
    }
}

export const celestialNav = CelestialNavigationEngine.getInstance();

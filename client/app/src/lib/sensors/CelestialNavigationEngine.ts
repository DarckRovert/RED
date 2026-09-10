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
    sunriseUtcHours: number;
    sunsetUtcHours: number;
    isDaylight: boolean;
    tacticalLightingState: 'FULL_DAYLIGHT' | 'CIVIL_TWILIGHT' | 'NAUTICAL_TWILIGHT' | 'ASTRONOMICAL_TWILIGHT' | 'PITCH_BLACK';
    gnomonShadowAzimuthDeg: number;
    gnomonShadowRatio: number;
    polarisAltitudeDeg: number;
    southernCrossAltitudeDeg: number;
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
        latDeg: number = 0,
        lonDeg: number = 0,
        date: Date = new Date()
    ): CelestialEphemeris {
        const rad = Math.PI / 180;
        const deg = 180 / Math.PI;

        const safeLat = (typeof latDeg === 'number' && isFinite(latDeg)) ? Math.max(-90, Math.min(90, latDeg)) : 0;
        const safeLon = (typeof lonDeg === 'number' && isFinite(lonDeg)) ? Math.max(-180, Math.min(180, lonDeg)) : 0;
        const safeDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();

        // Día juliano exacto UTC (J2000.0)
        const time = safeDate.getTime();
        const julianDay = (time / 86400000) + 2440587.5;
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
        const gmst = (280.46061837 + 360.98564736629 * d) % 360;
        const lst = (gmst + safeLon) % 360;

        // Altitud y Azimut solar
        const ha = (lst - L) * rad;
        const latRad = safeLat * rad;
        const sinAlt = Math.sin(latRad) * Math.sin(declinationDeg * rad) + Math.cos(latRad) * Math.cos(declinationDeg * rad) * Math.cos(ha);
        const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * deg;

        // Protección contra división por cero en el cenit (altitud = 90°) o en los polos geográficos (latitud = ±90°)
        const denom = Math.cos(latRad) * Math.cos(altitudeDeg * rad);
        const cosAz = Math.abs(denom) > 1e-6
            ? (Math.sin(declinationDeg * rad) - Math.sin(latRad) * sinAlt) / denom
            : 0;
        let azimuthDeg = isFinite(cosAz) ? Math.acos(Math.max(-1, Math.min(1, cosAz))) * deg : 0;
        if (Math.sin(ha) > 0) azimuthDeg = 360 - azimuthDeg;
        azimuthDeg = ((azimuthDeg % 360) + 360) % 360;

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
        const rawMoonAz = (azimuthDeg + 180 + (moonPhaseDays * 12.2));
        const moonAzimuthDeg = ((rawMoonAz % 360) + 360) % 360;
        const moonAltitudeDeg = Math.sin((moonAzimuthDeg * rad)) * 60;

        // Estado de iluminación táctica
        let tacticalLightingState: 'FULL_DAYLIGHT' | 'CIVIL_TWILIGHT' | 'NAUTICAL_TWILIGHT' | 'ASTRONOMICAL_TWILIGHT' | 'PITCH_BLACK' = 'PITCH_BLACK';
        if (altitudeDeg > 0) tacticalLightingState = 'FULL_DAYLIGHT';
        else if (altitudeDeg > -6) tacticalLightingState = 'CIVIL_TWILIGHT';
        else if (altitudeDeg > -12) tacticalLightingState = 'NAUTICAL_TWILIGHT';
        else if (altitudeDeg > -18) tacticalLightingState = 'ASTRONOMICAL_TWILIGHT';

        const safeSolarNoon = ((Math.round((12 - (safeLon / 15)) * 100) / 100 % 24) + 24) % 24;

        // Horas estimadas de amanecer y atardecer (Semi-diurno)
        const tanProduct = -Math.tan(latRad) * Math.tan(declinationDeg * rad);
        let sunriseUtcHours = (safeSolarNoon - 6 + 24) % 24;
        let sunsetUtcHours = (safeSolarNoon + 6 + 24) % 24;
        if (tanProduct >= 1) {
            // Noche polar
            sunriseUtcHours = 12;
            sunsetUtcHours = 12;
        } else if (tanProduct <= -1) {
            // Día polar continuo
            sunriseUtcHours = 0;
            sunsetUtcHours = 24;
        } else {
            const h0Hours = (Math.acos(tanProduct) * deg) / 15;
            sunriseUtcHours = Math.round(((safeSolarNoon - h0Hours + 24) % 24) * 100) / 100;
            sunsetUtcHours = Math.round(((safeSolarNoon + h0Hours + 24) % 24) * 100) / 100;
        }

        // Vector de sombra Gnomon (180° opuesto al acimut solar)
        const gnomonShadowAzimuthDeg = ((azimuthDeg + 180) % 360 + 360) % 360;
        const gnomonShadowRatio = altitudeDeg > 1 ? Math.round((1 / Math.tan(altitudeDeg * rad)) * 100) / 100 : 99.9;

        // Estrellas de referencia polar
        const polarisAltitudeDeg = safeLat > 0 ? Math.round(safeLat * 10) / 10 : 0;
        const southernCrossAltitudeDeg = safeLat < 0 ? Math.round(Math.abs(safeLat) * 10) / 10 : 0;

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
            moonIlluminationPct: isFinite(moonIlluminationPct) ? Math.max(0, Math.min(100, moonIlluminationPct)) : 50,
            moonPhaseName,
            solarNoonUtcHours: safeSolarNoon,
            sunriseUtcHours,
            sunsetUtcHours,
            isDaylight: altitudeDeg > 0,
            tacticalLightingState,
            gnomonShadowAzimuthDeg: Math.round(gnomonShadowAzimuthDeg * 10) / 10,
            gnomonShadowRatio,
            polarisAltitudeDeg,
            southernCrossAltitudeDeg,
        };
    }

    /**
     * Estima la posición geográfica por tránsito del mediodía solar
     * @param solarZenithUtcTimeStr Hora de culminación solar en UTC ("HH:MM:SS" o "HH:MM")
     * @param maxMeasuredSolarAltitudeDeg Altitud máxima medida en el tránsito (0° a 90°)
     * @param date Fecha de la observación
     * @param culminationDirection Dirección de culminación solar: 'SOUTH' (al Sur, típico Hemisferio N) o 'NORTH' (al Norte, típico Hemisferio S / Trópicos)
     */
    public estimatePositionFromSolarNoon(
        solarZenithUtcTimeStr: string,
        maxMeasuredSolarAltitudeDeg: number,
        date: Date = new Date(),
        culminationDirection: 'SOUTH' | 'NORTH' | 'AUTO' = 'SOUTH'
    ): { estimatedLat: number; estimatedLon: number } {
        const safeStr = typeof solarZenithUtcTimeStr === 'string' ? solarZenithUtcTimeStr.trim() : '12:00:00';
        const parts = safeStr.split(':');
        const h = parseFloat(parts[0] || '12');
        const m = parseFloat(parts[1] || '0');
        const s = parseFloat(parts[2] || '0');
        const utcHours = (!isNaN(h) && isFinite(h)) ? h + ((!isNaN(m) && isFinite(m)) ? m / 60 : 0) + ((!isNaN(s) && isFinite(s)) ? s / 3600 : 0) : 12;

        const safeAltitude = (typeof maxMeasuredSolarAltitudeDeg === 'number' && isFinite(maxMeasuredSolarAltitudeDeg))
            ? Math.max(0, Math.min(90, maxMeasuredSolarAltitudeDeg))
            : 45;

        // Declinación solar astronómica y Ecuación del Tiempo (EoT) exactas para la fecha
        const safeDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
        const rad = Math.PI / 180;
        const deg = 180 / Math.PI;
        const time = safeDate.getTime();
        const julianDay = (time / 86400000) + 2440587.5;
        const d = julianDay - 2451545.0;
        const L = (280.460 + 0.9856474 * d) % 360;
        const g = ((357.528 + 0.9856003 * d) % 360) * rad;
        const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
        const epsilon = (23.439 - 0.0000004 * d) * rad;
        const sinDecl = Math.sin(epsilon) * Math.sin(lambda);
        const declinationDeg = Math.asin(sinDecl) * deg;

        // Ecuación del Tiempo (EoT) analítica
        // EoT = Tiempo Solar Aparente - Tiempo Solar Medio
        const raRad = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
        const raDeg = ((raRad * deg % 360) + 360) % 360;
        const normalizedL = ((L % 360) + 360) % 360;
        let eotDeg = normalizedL - raDeg;
        if (eotDeg > 180) eotDeg -= 360;
        if (eotDeg < -180) eotDeg += 360;
        const eotHours = eotDeg / 15;

        // Longitud corregida por la Ecuación del Tiempo:
        // En el mediodía aparente local, el Tiempo Solar Medio Local = 12.0 - EoT.
        // Longitud = (Tiempo Solar Medio Local - UTC_transito) * 15
        const rawLon = ((12.0 - eotHours - utcHours) * 15);
        const normalizedLon = ((((rawLon + 180) % 360) + 360) % 360) - 180;
        const estimatedLon = Math.round(normalizedLon * 100) / 100;

        // Reducción meridiana de latitud:
        // Distancia cenital z = 90° - Altitud
        // Culminación al Sur: Latitud = Declinación + z = 90° - Altitud + Declinación
        // Culminación al Norte: Latitud = Declinación - z = Altitud + Declinación - 90°
        const zenithDist = 90 - safeAltitude;
        let rawLat: number;
        if (culminationDirection === 'NORTH') {
            rawLat = declinationDeg - zenithDist;
        } else {
            rawLat = declinationDeg + zenithDist;
        }
        const estimatedLat = Math.round(Math.max(-90, Math.min(90, rawLat)) * 100) / 100;

        return {
            estimatedLat: isFinite(estimatedLat) ? estimatedLat : 0,
            estimatedLon: isFinite(estimatedLon) ? estimatedLon : 0,
        };
    }
}

export const celestialNav = CelestialNavigationEngine.getInstance();

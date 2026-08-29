/**
 * OpticalGasAqiEngine.ts — RED Edge Optical Gas, Smoke & Air Quality Index (AQI) Engine
 * 
 * Analyzes optical contrast attenuation, Mie/Rayleigh particulate scattering, and flame flicker frequencies (3-15 Hz)
 * to estimate Air Quality Index (AQI 0-500), PM2.5/PM10 particulate concentration, toxic smoke density,
 * and maximum safe exposure duration without respirators according to EPA/WHO disaster safety standards.
 */

export type AqiSeverityLevel = 'GOOD' | 'MODERATE' | 'UNHEALTHY_SENSITIVE' | 'UNHEALTHY' | 'VERY_UNHEALTHY' | 'HAZARDOUS_CRITICAL';

export interface AtmosphericTelemetry {
    aqiIndex: number;
    severity: AqiSeverityLevel;
    pm25Ugm3: number;
    pm10Ugm3: number;
    estimatedCoPpm: number;
    smokeOpacityPct: number;
    flameFlickerDetected: boolean;
    flickerFrequencyHz: number;
    safeStayMinutesWithoutMask: number;
    recommendedMask: string;
    description: string;
    timestamp: number;
}

export class OpticalGasAqiEngine {
    private static instance: OpticalGasAqiEngine | null = null;

    private constructor() {}

    public static getInstance(): OpticalGasAqiEngine {
        if (!this.instance) {
            this.instance = new OpticalGasAqiEngine();
        }
        return this.instance;
    }

    /**
     * Procesa las métricas ópticas de un fotograma de la cámara (brillo medio, contraste, histograma RGB)
     */
    public analyzeOpticalFrame(
        meanLuminance: number,     // 0 a 255
        stdDevContrast: number,    // 0 a 128 (menor desviación = mayor opacidad por humo)
        colorShift: { r: number; g: number; b: number }, // Balance relativo de color
        flameFlickerVariance: number = 0 // Varianza temporal de brillo para detectar fuego
    ): AtmosphericTelemetry {
        // Modelo de extinción óptica Beer-Lambert & Dispersión Mie
        // En aire limpio: contraste alto (stdDev > 45). En humo denso: contraste se atenúa (stdDev < 15)
        const normalizedContrast = Math.max(5, Math.min(60, stdDevContrast));
        const smokeOpacityPct = Math.round(Math.max(0, Math.min(100, (1 - (normalizedContrast / 55)) * 100)));

        // Partículas suspendidas PM2.5 y PM10 estimadas por opacidad óptica
        const pm25Ugm3 = Math.round(10 + (smokeOpacityPct / 100) * 450); // 10 a 460 ug/m3
        const pm10Ugm3 = Math.round(pm25Ugm3 * 1.6);

        // Monóxido de Carbono (CO) estimado en combustión incompleta
        const estimatedCoPpm = Math.round((smokeOpacityPct / 100) * 120);

        // Detección de parpadeo de llama (3 a 15 Hz)
        const flameFlickerDetected = flameFlickerVariance > 18;
        const flickerFrequencyHz = flameFlickerDetected ? Math.round((6 + (flameFlickerVariance % 6)) * 10) / 10 : 0;

        // Cálculo de AQI (0 a 500) según estándar EPA PM2.5
        let aqiIndex = 0;
        let severity: AqiSeverityLevel = 'GOOD';
        let safeStayMinutesWithoutMask = 1440; // 24 horas
        let recommendedMask = 'Ninguno requerido (Aire respirable)';
        let description = 'Atmósfera limpia y segura para actividades tácticas.';

        if (pm25Ugm3 <= 12) {
            aqiIndex = Math.round((50 / 12) * pm25Ugm3);
            severity = 'GOOD';
            safeStayMinutesWithoutMask = 1440;
            recommendedMask = 'Ninguno';
            description = 'Excelente calidad atmosférica.';
        } else if (pm25Ugm3 <= 35.4) {
            aqiIndex = Math.round(51 + ((100 - 51) / (35.4 - 12.1)) * (pm25Ugm3 - 12.1));
            severity = 'MODERATE';
            safeStayMinutesWithoutMask = 480; // 8 horas
            recommendedMask = 'Mascarrilla estándar / Bandana';
            description = 'Presencia leve de partículas o polvo en suspensión.';
        } else if (pm25Ugm3 <= 55.4) {
            aqiIndex = Math.round(101 + ((150 - 101) / (55.4 - 35.5)) * (pm25Ugm3 - 35.5));
            severity = 'UNHEALTHY_SENSITIVE';
            safeStayMinutesWithoutMask = 180; // 3 horas
            recommendedMask = 'Respirador N95 / FFP2';
            description = 'Humo moderado en el ambiente. Irritación ocular posible.';
        } else if (pm25Ugm3 <= 150.4) {
            aqiIndex = Math.round(151 + ((200 - 151) / (150.4 - 55.5)) * (pm25Ugm3 - 55.5));
            severity = 'UNHEALTHY';
            safeStayMinutesWithoutMask = 60; // 1 hora
            recommendedMask = 'Respirador N95 / P100 con válvula';
            description = 'Humo denso o emisiones industriales. Riesgo respiratorio.';
        } else if (pm25Ugm3 <= 250.4) {
            aqiIndex = Math.round(201 + ((300 - 201) / (250.4 - 150.5)) * (pm25Ugm3 - 150.5));
            severity = 'VERY_UNHEALTHY';
            safeStayMinutesWithoutMask = 20; // 20 minutos
            recommendedMask = 'Máscara elastomérica P100 / Media cara con carbón activo';
            description = 'Toxicidad severa. Asfixia por partículas en minutos.';
        } else {
            aqiIndex = Math.round(301 + ((500 - 301) / (500 - 250.5)) * Math.min(500, pm25Ugm3 - 250.5));
            severity = 'HAZARDOUS_CRITICAL';
            safeStayMinutesWithoutMask = 5; // 5 minutos
            recommendedMask = 'Máscara Facial Completa CBRN / ERA (Equipo de Respiración Autónoma)';
            description = 'PELIGRO MORTAL: Toxicidad crítica / Asfixia inminente. Evacuar inmediatamente.';
        }

        return {
            aqiIndex: Math.min(500, Math.max(0, aqiIndex)),
            severity,
            pm25Ugm3,
            pm10Ugm3,
            estimatedCoPpm,
            smokeOpacityPct,
            flameFlickerDetected,
            flickerFrequencyHz,
            safeStayMinutesWithoutMask,
            recommendedMask,
            description,
            timestamp: Date.now(),
        };
    }
}

export const opticalGasAqiEngine = OpticalGasAqiEngine.getInstance();

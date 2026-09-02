/**
 * CbrnRadiationEngine.ts — RED Tactical CBRN Nuclear Radiation & Dosimetry Telemetry Engine
 * 
 * Provides real-time dose rate measurement (uSv/h & CPM), cumulative biological dose tracking (mSv),
 * safe stay-time calculation (T_stay), and Acute Radiation Sickness (ARS) risk assessment for civilian/tactical survival.
 */

export type CbrnThreatLevel = 'SAFE_BACKGROUND' | 'ELEVATED' | 'HAZARDOUS' | 'LETHAL';

export interface RadiationTelemetry {
    doseRateUsVh: number;       // MicroSieverts por hora (0.05 - 0.25 normal background)
    countsPerMinuteCpm: number;  // CPM estimado
    cumulativeDoseMsv: number;   // Dosis biológica acumulada en miliSieverts
    safeStayTimeMinutes: number; // Tiempo seguro antes de alcanzar el límite de 50 mSv
    threatLevel: CbrnThreatLevel;
    arsRiskDescription: string;
    isSensorOnline: boolean;
}

export class CbrnRadiationEngine {
    private static instance: CbrnRadiationEngine | null = null;

    private doseRateUsVh: number = 0.12; // Fondo ambiental típico
    private cumulativeDoseMsv: number = 0.00;
    private isRunning: boolean = false;
    private isManualOverride: boolean = false;
    private timer: any = null;

    private listeners: Set<(t: RadiationTelemetry) => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('red_cbrn_cum_dose_msv');
                if (saved) {
                    const parsed = parseFloat(saved);
                    this.cumulativeDoseMsv = (isFinite(parsed) && parsed >= 0) ? parsed : 0;
                }
            } catch {}
        }
    }

    public static getInstance(): CbrnRadiationEngine {
        if (!this.instance) {
            this.instance = new CbrnRadiationEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: RadiationTelemetry) => void): () => void {
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

    public recordCmosPhotonHits(hotPixelCount: number, exposureTimeMs = 33.3): void {
        if (!isFinite(hotPixelCount) || hotPixelCount < 0 || !isFinite(exposureTimeMs) || exposureTimeMs <= 0) return;
        // Física nuclear CMOS: los fotones gamma y partículas beta que atraviesan la matriz
        // de silicio de la cámara generan pares electrón-hueco (hot pixels luminosos con lente tapada).
        // 1. Tasa de eventos por minuto (CPM)
        const cpmCalculated = Math.round((hotPixelCount / (exposureTimeMs / 1000)) * 60);
        // 2. Factor de conversión estándar silicio CMOS a dosis equivalente ambiental H*(10): 120 CPM ≈ 1.0 uSv/h
        const derivedDose = Math.max(0.04, Math.round((cpmCalculated / 120) * 100) / 100);

        this.doseRateUsVh = isFinite(derivedDose) ? derivedDose : 0.04;
        this.isManualOverride = false;
        this.notify();
    }

    public startMonitoring() {
        if (this.isRunning) return;
        this.isRunning = true;

        this.timer = setInterval(() => {
            // Acumular dosis biológica por segundo (uSv/h convertido a mSv/s)
            const safeRate = (typeof this.doseRateUsVh === 'number' && isFinite(this.doseRateUsVh) && this.doseRateUsVh >= 0) ? this.doseRateUsVh : 0.12;
            const dosePerSecMsv = (safeRate / 1000) / 3600;
            const currentCum = (typeof this.cumulativeDoseMsv === 'number' && isFinite(this.cumulativeDoseMsv) && this.cumulativeDoseMsv >= 0) ? this.cumulativeDoseMsv : 0;
            this.cumulativeDoseMsv = Math.round((currentCum + dosePerSecMsv) * 10000) / 10000;

            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('red_cbrn_cum_dose_msv', this.cumulativeDoseMsv.toString());
                } catch {}
            }

            this.notify();
        }, 1000);
    }

    public stopMonitoring() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    public destroy(): void {
        this.stopMonitoring();
        this.listeners.clear();
    }

    /**
     * Inyecta una tasa de dosis para pruebas tácticas o integración con sondas Geiger externas USB/BLE
     */
    public setDoseRate(rateUsVh: number, isExternalProbe = true) {
        this.isManualOverride = isExternalProbe;
        const safeRate = (typeof rateUsVh === 'number' && isFinite(rateUsVh) && rateUsVh >= 0) ? rateUsVh : 0;
        this.doseRateUsVh = safeRate;
        this.notify();
    }

    public resetCumulativeDose() {
        this.cumulativeDoseMsv = 0;
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('red_cbrn_cum_dose_msv');
            } catch {}
        }
        this.notify();
    }

    public getTelemetry(): RadiationTelemetry {
        const rate = (typeof this.doseRateUsVh === 'number' && isFinite(this.doseRateUsVh) && this.doseRateUsVh >= 0) ? this.doseRateUsVh : 0.12;
        const cum = (typeof this.cumulativeDoseMsv === 'number' && isFinite(this.cumulativeDoseMsv) && this.cumulativeDoseMsv >= 0) ? this.cumulativeDoseMsv : 0;
        const cpm = Math.round(rate * 120); // Factor de conversión estándar para tubo GM LND-712

        let threatLevel: CbrnThreatLevel = 'SAFE_BACKGROUND';
        let arsDesc = 'Radiación de fondo ambiental normal. Sin riesgo biológico detectable.';

        if (rate > 1000) {
            threatLevel = 'LETHAL';
            arsDesc = 'PELIGRO EXTREMO: Tasa letal. Riesgo inminente de ARS severo y fallo orgánico. Evacuación inmediata.';
        } else if (rate > 50) {
            threatLevel = 'HAZARDOUS';
            arsDesc = 'ZONA CALIENTE CBRN: Exposición aguda peligrosa. Use protección respiratoria y blindaje de plomo/hormigón.';
        } else if (rate > 2.5) {
            threatLevel = 'ELEVATED';
            arsDesc = 'Nivel elevado. Supera el límite de seguridad civil. Limite el tiempo de permanencia.';
        }

        // Límite de dosis de emergencia para rescatistas: 50 mSv
        const remainingDoseMsv = Math.max(0, 50 - cum);
        let safeStayMins = 99999;
        if (remainingDoseMsv <= 0) {
            safeStayMins = 0;
        } else if (rate > 0.0001) {
            const calculated = Math.round((remainingDoseMsv / (rate / 1000)) * 60);
            safeStayMins = Math.min(99999, Math.max(0, isFinite(calculated) ? calculated : 99999));
        }

        return {
            doseRateUsVh: rate,
            countsPerMinuteCpm: cpm,
            cumulativeDoseMsv: cum,
            safeStayTimeMinutes: safeStayMins,
            threatLevel,
            arsRiskDescription: arsDesc,
            isSensorOnline: true,
        };
    }
}

export const cbrnRadiation = CbrnRadiationEngine.getInstance();

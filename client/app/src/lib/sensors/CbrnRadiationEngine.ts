/**
 * CbrnRadiationEngine.ts — RED Tactical CBRN Nuclear Radiation & Dosimetry Telemetry Engine
 * 
 * Provides real-time dose rate measurement (uSv/h & CPM), cumulative biological dose tracking (mSv),
 * safe stay-time calculation (T_stay), Acute Radiation Sickness (ARS) risk assessment, and
 * real camera CMOS silicon sensor photon impact detection with optical darkness validation.
 */

export type CbrnThreatLevel = 'SAFE_BACKGROUND' | 'ELEVATED' | 'HAZARDOUS' | 'LETHAL';

export type CbrnSimulationScenario = 'NONE' | 'BACKGROUND' | 'ELEVATED' | 'HOT_ZONE' | 'LETHAL';

export interface RadiationTelemetry {
    doseRateUsVh: number;           // MicroSieverts por hora (0.05 - 0.25 normal background)
    countsPerMinuteCpm: number;      // CPM estimado
    cumulativeDoseMsv: number;       // Dosis biológica acumulada en miliSieverts
    safeStayTimeMinutes: number;     // Tiempo seguro antes de alcanzar el límite de 50 mSv
    threatLevel: CbrnThreatLevel;
    arsRiskDescription: string;
    isSensorOnline: boolean;
    isCameraCmosActive: boolean;
    isLensCovered: boolean;
    averageLuminance: number;
    hotPixelHitsLastFrame: number;
    activeSimulationScenario: CbrnSimulationScenario;
}

export class CbrnRadiationEngine {
    private static instance: CbrnRadiationEngine | null = null;

    private doseRateUsVh: number = 0.12; // Fondo ambiental típico
    private cumulativeDoseMsv: number = 0.00;
    private isRunning: boolean = false;
    private isManualOverride: boolean = false;
    private timer: any = null;

    // CMOS Camera Video Capture Pipeline
    private videoStream: MediaStream | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private canvasElement: HTMLCanvasElement | null = null;
    private canvasCtx: CanvasRenderingContext2D | null = null;
    private isCameraActive: boolean = false;
    private isLensCovered: boolean = false;
    private averageLuminance: number = 0;
    private hotPixelHitsLastFrame: number = 0;
    private cmosScanInterval: any = null;
    private activeSimulationScenario: CbrnSimulationScenario = 'NONE';

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

    /**
     * Inicia la captura física de la cámara trasera para análisis fotónico CMOS
     */
    public async startCmosCameraCapture(): Promise<boolean> {
        if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
            return false;
        }

        try {
            if (this.videoStream) {
                this.stopCmosCameraCapture();
            }

            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });

            if (!this.videoElement) {
                this.videoElement = document.createElement('video');
                this.videoElement.setAttribute('playsinline', 'true');
                this.videoElement.muted = true;
            }

            this.videoElement.srcObject = this.videoStream;
            await this.videoElement.play().catch(() => {});

            if (!this.canvasElement) {
                this.canvasElement = document.createElement('canvas');
                this.canvasElement.width = 160; // Resolución optimizada para rendimiento móvil continuo
                this.canvasElement.height = 120;
                this.canvasCtx = this.canvasElement.getContext('2d', { willReadFrequently: true });
            }

            this.isCameraActive = true;

            // Escaneo continuo a ~20 FPS (50ms interval)
            if (this.cmosScanInterval) clearInterval(this.cmosScanInterval);
            this.cmosScanInterval = setInterval(() => {
                this.processCmosFrame(50);
            }, 50);

            this.notify();
            return true;
        } catch (err) {
            console.warn('[CbrnRadiationEngine] No se pudo activar la cámara CMOS:', err);
            this.isCameraActive = false;
            this.notify();
            return false;
        }
    }

    /**
     * Procesa un frame de video capturado por el sensor CMOS
     */
    private processCmosFrame(frameIntervalMs: number): void {
        if (!this.videoElement || !this.canvasCtx || !this.canvasElement || !this.isCameraActive) return;
        if (this.videoElement.readyState < 2) return;

        try {
            const w = this.canvasElement.width;
            const h = this.canvasElement.height;
            this.canvasCtx.drawImage(this.videoElement, 0, 0, w, h);
            const imgData = this.canvasCtx.getImageData(0, 0, w, h);
            const pixels = imgData.data;
            const totalPixels = w * h;

            let totalBrightness = 0;
            let hotPixels = 0;

            // 1. Medir nivel de luminancia media para verificar lente tapado
            for (let i = 0; i < pixels.length; i += 16) { // Muestreo rápido de iluminación
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
            }
            const avgLum = Math.round((totalBrightness / (totalPixels / 4)) * 10) / 10;
            this.averageLuminance = avgLum;

            // El lente está cubierto si la luminancia promedio es menor a 20 (oscuridad requerida)
            this.isLensCovered = avgLum < 20.0;

            if (this.isLensCovered) {
                // 2. Con lente cubierto, cualquier punto luminoso aislado es un impacto de fotón ionizante
                // Umbral alto de intensidad: píxeles individuales con valor > 200 en rojo/verde/azul
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    if (r > 200 || g > 200 || b > 200) {
                        hotPixels++;
                    }
                }

                this.hotPixelHitsLastFrame = hotPixels;

                // Solo actualizar si no hay escenario de simulación manual forzado
                if (this.activeSimulationScenario === 'NONE' && !this.isManualOverride) {
                    this.recordCmosPhotonHits(hotPixels, frameIntervalMs);
                }
            } else {
                this.hotPixelHitsLastFrame = 0;
            }

            this.notify();
        } catch {}
    }

    public stopCmosCameraCapture(): void {
        if (this.cmosScanInterval) {
            clearInterval(this.cmosScanInterval);
            this.cmosScanInterval = null;
        }
        if (this.videoStream) {
            try {
                this.videoStream.getTracks().forEach(t => t.stop());
            } catch {}
            this.videoStream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        this.isCameraActive = false;
        this.isLensCovered = false;
        this.hotPixelHitsLastFrame = 0;
        this.notify();
    }

    /**
     * Configura un escenario de simulación táctica para pruebas y simulacros
     */
    public setSimulationScenario(scenario: CbrnSimulationScenario): void {
        this.activeSimulationScenario = scenario;
        switch (scenario) {
            case 'BACKGROUND':
                this.setDoseRate(0.12, false);
                break;
            case 'ELEVATED':
                this.setDoseRate(4.8, true);
                break;
            case 'HOT_ZONE':
                this.setDoseRate(85.0, true);
                break;
            case 'LETHAL':
                this.setDoseRate(1450.0, true);
                break;
            case 'NONE':
            default:
                this.isManualOverride = false;
                this.setDoseRate(0.12, false);
                break;
        }
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
        this.stopCmosCameraCapture();
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
            isCameraCmosActive: this.isCameraActive,
            isLensCovered: this.isLensCovered,
            averageLuminance: this.averageLuminance,
            hotPixelHitsLastFrame: this.hotPixelHitsLastFrame,
            activeSimulationScenario: this.activeSimulationScenario
        };
    }
}

export const cbrnRadiation = CbrnRadiationEngine.getInstance();

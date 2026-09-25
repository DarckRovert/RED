/**
 * KineticStressEngine.ts — RED Sovereign Mesh OS
 * 
 * Motor de Detección de Estrés Cinético y Fisiológico de Alta Fidelidad.
 * Analiza vectores de aceleración triaxial en tiempo real para cuantificar:
 * 1. Temblor fisiológico involuntario en la banda 8-12 Hz (shock simpático / hipotermia / combate).
 * 2. Variabilidad cinética y cinemática de pánico o forcejeo.
 * 3. Integración bidireccional con ManDownDetectorEngine (impacto violento > 2.4g e inmovilidad).
 * 
 * Su telemetría gobierna de forma autónoma la prioridad de enrutamiento en meshRouter
 * y la conmutación de portadores en DynamicBearerGovernor.
 */

import { ManDownDetectorEngine, ManDownTelemetry } from './ManDownDetectorEngine';

export type KineticStressLevel = 'NOMINAL' | 'ELEVATED' | 'CRITICAL_SHOCK';

export interface KineticStressTelemetry {
  level: KineticStressLevel;
  tremorFrequencyHz: number;
  tremorIntensity: number; // 0.0 a 1.0
  isManDownActive: boolean;
  immobilityDurationSec: number;
  lastImpactMagnitude: number;
  timestamp: number;
}

export class KineticStressEngine {
  private static instance: KineticStressEngine | null = null;

  private isRunning = false;
  private currentLevel: KineticStressLevel = 'NOMINAL';
  private tremorFrequencyHz = 0;
  private tremorIntensity = 0;
  private lastImpactMagnitude = 1.0;
  private isManDownActive = false;
  private immobilityDurationSec = 0;

  // Búfer deslizante de aceleración para análisis espectral (50 Hz, 32 muestras ~640 ms)
  private readonly WINDOW_SIZE = 32;
  private accelMagnitudeHistory: number[] = [];
  private timestampHistory: number[] = [];

  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private manDownUnsub: (() => void) | null = null;
  private evalTimer: ReturnType<typeof setInterval> | null = null;

  private listeners: Set<(t: KineticStressTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): KineticStressEngine {
    if (!this.instance) {
      this.instance = new KineticStressEngine();
    }
    return this.instance;
  }

  public subscribe(cb: (t: KineticStressTelemetry) => void): () => void {
    this.listeners.add(cb);
    cb(this.getTelemetry());
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    const telemetry = this.getTelemetry();
    this.listeners.forEach((cb) => {
      try {
        cb(telemetry);
      } catch (err) {
        console.error('[KineticStressEngine] Listener error:', err);
      }
    });
  }

  public getTelemetry(): KineticStressTelemetry {
    return {
      level: this.currentLevel,
      tremorFrequencyHz: Math.round(this.tremorFrequencyHz * 10) / 10,
      tremorIntensity: Math.round(this.tremorIntensity * 100) / 100,
      isManDownActive: this.isManDownActive,
      immobilityDurationSec: this.immobilityDurationSec,
      lastImpactMagnitude: Math.round(this.lastImpactMagnitude * 100) / 100,
      timestamp: Date.now(),
    };
  }

  /**
   * Inicia el análisis espectral y la escucha de hardware
   */
  public start(): boolean {
    if (this.isRunning) return true;
    this.isRunning = true;

    // 1. Suscripción a ManDownDetectorEngine
    try {
      const manDown = ManDownDetectorEngine.getInstance();
      this.manDownUnsub = manDown.subscribe((tel: ManDownTelemetry) => {
        const wasManDown = this.isManDownActive;
        this.isManDownActive =
          tel.state === 'IMPACT_DETECTED' ||
          tel.state === 'PRE_ALARM_COUNTDOWN' ||
          tel.state === 'ALARM_DISPATCHED';
        this.immobilityDurationSec = tel.immobilityDurationSec;
        this.lastImpactMagnitude = tel.lastMagnitude;

        if (this.isManDownActive) {
          if (this.currentLevel !== 'CRITICAL_SHOCK') {
            this.currentLevel = 'CRITICAL_SHOCK';
            this.notify();
          }
        } else if (wasManDown && !this.isManDownActive) {
          // Cese de la emergencia Man-Down: re-evaluar inmediatamente con el búfer cinético real
          this.evaluateSpectralTremor();
        }
      });
    } catch (err) {
      console.warn('[KineticStressEngine] ManDown subscription failed:', err);
    }

    // 2. Escucha de Acelerómetro Físico en Dispositivos Reales
    if (typeof window !== 'undefined') {
      this.motionHandler = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;

        const x = acc.x ?? 0;
        const y = acc.y ?? 0;
        const z = acc.z ?? 0;

        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return;

        const mag = Math.hypot(x, y, z);
        const now = performance.now();

        this.accelMagnitudeHistory.push(mag);
        this.timestampHistory.push(now);

        if (this.accelMagnitudeHistory.length > this.WINDOW_SIZE) {
          this.accelMagnitudeHistory.shift();
          this.timestampHistory.shift();
        }
      };

      window.addEventListener('devicemotion', this.motionHandler, { passive: true });

      // 3. Evaluador periódico del temblor espectral cada 250 ms
      this.evalTimer = setInterval(() => {
        this.evaluateSpectralTremor();
      }, 250);
    }

    this.notify();
    return true;
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (typeof window !== 'undefined' && this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }

    if (this.manDownUnsub) {
      this.manDownUnsub();
      this.manDownUnsub = null;
    }

    if (this.evalTimer) {
      clearInterval(this.evalTimer);
      this.evalTimer = null;
    }

    this.accelMagnitudeHistory = [];
    this.timestampHistory = [];
    this.currentLevel = 'NOMINAL';
    this.tremorFrequencyHz = 0;
    this.tremorIntensity = 0;
    this.isManDownActive = false;
    this.notify();
  }

  /**
   * Procesa la serie temporal del acelerómetro usando Zero-Crossing Rate (ZCR)
   * y estimación de potencia en la banda de 8-12 Hz (temblor neuromuscular fisiológico).
   */
  public evaluateSpectralTremor(): void {
    if (this.accelMagnitudeHistory.length < 16) return;

    const n = this.accelMagnitudeHistory.length;
    const mean = this.accelMagnitudeHistory.reduce((a, b) => a + b, 0) / n;

    // Calcular varianza centrada en la media
    let variance = 0;
    for (let i = 0; i < n; i++) {
      variance += Math.pow(this.accelMagnitudeHistory[i] - mean, 2);
    }
    variance /= n;

    const previousLevel = this.currentLevel;
    const previousIntensity = this.tremorIntensity;
    const previousFreq = this.tremorFrequencyHz;

    // 1. Noise Gate Físico: Si la varianza es inferior al piso de ruido térmico MEMS (variance < 0.04 m²/s⁴)
    // el dispositivo está en reposo estático. Forzar 0 Hz y descartar falsos temblores por ruido blanco.
    if (variance < 0.04) {
      this.tremorFrequencyHz = 0;
      this.tremorIntensity = 0;
      this.currentLevel = this.isManDownActive ? 'CRITICAL_SHOCK' : 'NOMINAL';
      if (previousLevel !== this.currentLevel) {
        this.notify();
      }
      return;
    }

    // 2. Zero-Crossing Rate sobre la señal centrada
    let zeroCrossings = 0;
    for (let i = 1; i < n; i++) {
      const prev = this.accelMagnitudeHistory[i - 1] - mean;
      const curr = this.accelMagnitudeHistory[i] - mean;
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        zeroCrossings++;
      }
    }

    const durationSec = (this.timestampHistory[n - 1] - this.timestampHistory[0]) / 1000;
    if (durationSec <= 0.05) return;

    // Frecuencia estimada a partir del cruce por cero (f ~= ZCR / (2 * T))
    const estimatedFreqHz = zeroCrossings / (2 * durationSec);
    this.tremorFrequencyHz = estimatedFreqHz;

    // 3. Determinar si la oscilación cae en la banda fisiológica de temblor (7.5 Hz - 13.5 Hz)
    const isTremorBand = estimatedFreqHz >= 7.5 && estimatedFreqHz <= 13.5;
    const tremorEnergy = Math.min(1.0, Math.sqrt(variance) / 3.0);
    this.tremorIntensity = isTremorBand ? tremorEnergy : tremorEnergy * 0.2;

    // 4. Decisión de Estado de Estrés Fisiológico
    if (this.isManDownActive || (this.tremorIntensity > 0.65 && isTremorBand)) {
      this.currentLevel = 'CRITICAL_SHOCK';
    } else if (this.tremorIntensity > 0.30 || (variance > 4.5 && !isTremorBand)) {
      this.currentLevel = 'ELEVATED';
    } else {
      this.currentLevel = 'NOMINAL';
    }

    const hasLevelChanged = previousLevel !== this.currentLevel;
    const hasSignificantMetricChange =
      Math.abs(previousIntensity - this.tremorIntensity) > 0.05 ||
      Math.abs(previousFreq - this.tremorFrequencyHz) > 0.5;

    if (hasLevelChanged || (this.currentLevel !== 'NOMINAL' && hasSignificantMetricChange)) {
      this.notify();
    }
  }

  /**
   * Inyección sintética para verificación en tests
   */
  public injectSyntheticMotion(samples: number[], sampleRateHz = 50): void {
    const dtMs = 1000 / sampleRateHz;
    let t = performance.now();
    for (const mag of samples) {
      this.accelMagnitudeHistory.push(mag);
      this.timestampHistory.push(t);
      t += dtMs;
    }
    if (this.accelMagnitudeHistory.length > this.WINDOW_SIZE) {
      this.accelMagnitudeHistory = this.accelMagnitudeHistory.slice(-this.WINDOW_SIZE);
      this.timestampHistory = this.timestampHistory.slice(-this.WINDOW_SIZE);
    }
    this.evaluateSpectralTremor();
  }
}

export const kineticStress = KineticStressEngine.getInstance();

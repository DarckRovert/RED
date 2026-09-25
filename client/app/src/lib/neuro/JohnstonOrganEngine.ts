/**
 * JohnstonOrganEngine.ts — RED Sovereign Mesh OS
 *
 * Emulación Biofísica del Órgano de Johnston (Johnston's Organ / JO)
 * de Drosophila melanogaster (MaleCNS v1.0, FlyWire Connectome / Princeton Murthy Lab).
 *
 * Fundamento Biológico & Neuroarquitectura:
 * El Órgano de Johnston es el receptor mecanosensorial antenal más sofisticado del insecto (~500 neuronas):
 * 1. Subgrupos Neuronales JO-AB: Sintonizados a vibraciones acústicas de alta frecuencia (100 Hz - 800 Hz),
 *    detección de batido de alas de congéneres y zumbidos de depredadores.
 * 2. Subgrupos Neuronales JO-CE: Sintonizados a deflexiones estáticas y de baja frecuencia (viento,
 *    aceleración gravitatoria y flujo aerodinámico).
 * 3. Enlace Táctico Monosináptico con el Sistema de Fibras Gigantes (Giant Fiber Reflex):
 *    Un impacto acústico/mecánico súbito (onda expansiva de explosión, detonación, choque de metralla o
 *    pisada cercana en silencio táctico) despolariza directamente la interneurona descendente DNp01
 *    induciendo silencio de radio (EMCON) y evasión inmediata antes de que la CPU procese audio.
 */

import { giantFiberReflex } from './GiantFiberReflexEngine';
import { AudioContextManager } from '../audio/AudioContextManager';

export interface MechanosensoryShockEvent {
  timestamp: number;
  peakEnergy: number;          // [0.0 - 1.0] Amplitud de energía mecanosensorial
  dominantFrequencyHz: number; // Frecuencia estimada (Hz)
  sourceType: 'ACOUSTIC_BLAST' | 'SEISMIC_TREMOR' | 'RF_AMPLITUDE_SURGE';
  deflectionAngleDeg: number;  // Ángulo aparente de deflexión antenal (-180° a +180°)
  triggeredReflex: boolean;    // Si activó el arco reflejo Giant Fiber
}

export interface JohnstonOrganTelemetry {
  timestamp: number;
  acousticEnergyLevel: number; // [0.0 - 1.0] Nivel de vibración acústica ambiente
  windDeflectionAngleDeg: number; // Vector de deflexión de viento/movimiento
  vibrationFrequencyHz: number;   // Frecuencia dominante actual
  joAbResonanceLevel: number;     // Resonancia de neuronas acústicas JO-AB [0.0 - 1.0]
  joCeDeflectionLevel: number;    // Deflexión estática de neuronas de viento JO-CE [0.0 - 1.0]
  shockEventsCount: number;
  lastShockEvent: MechanosensoryShockEvent | null;
  isListening: boolean;
  sensitivityThreshold: number;   // Umbral de disparo de choque (default: 0.72)
}

export class JohnstonOrganEngine {
  private static instance: JohnstonOrganEngine | null = null;

  // Umbrales biofísicos
  private sensitivityThreshold = 0.72; // Disparo de choque si energía > 0.72
  private isListening = false;

  // Estado sensorial en tiempo real
  private acousticEnergy = 0.0;
  private vibrationFreq = 0.0;
  private windDeflectionAngle = 0.0;
  private joAbResonance = 0.0;
  private joCeDeflection = 0.0;
  private shockEventsCount = 0;
  private lastShock: MechanosensoryShockEvent | null = null;

  // Listeners de hardware
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;
  private animationFrameId: any = null;

  // Suscriptores reactivos
  private listeners: Set<(telemetry: JohnstonOrganTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): JohnstonOrganEngine {
    if (!JohnstonOrganEngine.instance) {
      JohnstonOrganEngine.instance = new JohnstonOrganEngine();
    }
    return JohnstonOrganEngine.instance;
  }

  /**
   * Inicia la vigilancia mecanosensorial y acústica del Órgano de Johnston.
   */
  public start(): void {
    if (this.isListening) return;
    this.isListening = true;

    // 1. Acoplar acelerómetro para deflexión mecanosensorial estática/baja frecuencia (JO-CE)
    if (typeof window !== 'undefined') {
      this.motionHandler = (e: DeviceMotionEvent) => {
        let x = 0, y = 0, z = 0;
        if (e.acceleration && typeof e.acceleration.x === 'number') {
          x = e.acceleration.x;
          y = e.acceleration.y || 0;
          z = e.acceleration.z || 0;
        } else if (e.accelerationIncludingGravity && typeof e.accelerationIncludingGravity.x === 'number') {
          x = e.accelerationIncludingGravity.x;
          y = e.accelerationIncludingGravity.y || 0;
          z = (e.accelerationIncludingGravity.z || 9.81) - 9.81;
        }

        const mag = Math.sqrt(x * x + y * y + z * z);
        this.joCeDeflection = Math.min(1.0, mag / 12.0);
        this.windDeflectionAngle = (Math.atan2(x, y) * 180) / Math.PI;

        // Detección de impacto mecánico súbito (golpe, caída, explosión cercana)
        if (mag > 18.0) { // > 1.8G súbito
          this.processShockDetection(Math.min(1.0, mag / 25.0), 60.0, 'SEISMIC_TREMOR', this.windDeflectionAngle);
        }
      };

      window.addEventListener('devicemotion', this.motionHandler);
    }

    // 2. Intentar capturar audio ambiente de micrófono si AudioContext está disponible
    this.initAudioCaptureSafe();
  }

  public stop(): void {
    this.isListening = false;
    if (typeof window !== 'undefined' && this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
    AudioContextManager.releaseDedicatedContext('johnston_organ').catch(() => {});
    this.audioContext = null;
    this.notifyListeners();
  }

  /**
   * Inicializa la captura pasiva de audio de micrófono para sintonización acústica JO-AB.
   */
  private async initAudioCaptureSafe(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioStream = stream;

      this.audioContext = AudioContextManager.acquireDedicatedContext('johnston_organ');
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 512;
      source.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const pollLoop = () => {
        if (!this.isListening || !this.audioAnalyser) return;
        this.audioAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        let maxVal = 0;
        let maxIdx = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
          if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            maxIdx = i;
          }
        }
        const sampleRate = this.audioContext?.sampleRate || 44100;
        const domFreq = (maxIdx * sampleRate) / (bufferLength * 2);

        const energy = Math.min(1.0, (sum / bufferLength) / 128.0);
        this.acousticEnergy = energy;
        this.vibrationFreq = Math.round(domFreq);
        this.joAbResonance = Math.min(1.0, maxVal / 255.0);

        // Si la energía acústica supera el umbral de choque acústico / detonación
        if (energy >= this.sensitivityThreshold) {
          this.processShockDetection(energy, domFreq, 'ACOUSTIC_BLAST', this.windDeflectionAngle);
        }

        this.notifyListeners();
        this.animationFrameId = requestAnimationFrame(pollLoop);
      };

      this.animationFrameId = requestAnimationFrame(pollLoop);
    } catch {
      // Si el usuario deniega micrófono o corre en fondo, sigue operando con acelerómetro puramente
    }
  }

  // ─── Métodos de Entrada del ConnectomeBioBridge ───────────────────────────

  /**
   * Inyecta concentraciones químicas del hábitat físico (ConnectomeBioBridge).
   *
   * La glucosa eleva la resonancia JO-CE de baja frecuencia (vías de nutrición).
   * La feromona de alarma incrementa la energía acústica ambiental percibida,
   * aumentando la probabilidad de activar el arco reflejo de Giant Fiber.
   *
   * @param glucoseConc - Concentración de glucosa bajo las antenas [0-∞], normalizada internamente.
   * @param alarmConc   - Concentración de feromona de alarma [0-∞], normalizada internamente.
   */
  public updateChemicalInput(glucoseConc: number, alarmConc: number): void {
    // JO-CE: la glucosa produce una deflexión estática de baja frecuencia (atracción antenal)
    this.joCeDeflection = Math.min(1.0, Math.max(this.joCeDeflection * 0.85, Math.min(1.0, glucoseConc * 0.6)));

    // Alarma química: eleva la energía acústica ambiental percibida
    const alarmNorm = Math.min(1.0, alarmConc * 1.4);
    if (alarmNorm > this.acousticEnergy) {
      this.acousticEnergy = Math.min(1.0, this.acousticEnergy * 0.7 + alarmNorm * 0.3);
    } else {
      // Decaimiento exponencial si la feromona disminuye
      this.acousticEnergy = Math.max(0, this.acousticEnergy * 0.92);
    }
    this.notifyListeners();
  }

  /**
   * Dispara un choque mecánico directo desde el hábitat físico (ConnectomeBioBridge).
   *
   * Emula la perturbación mecanosensorial de una onda de air-puff golpeando las antenas.
   * Si la intensidad supera el umbral de disparo, activa el arco reflejo Giant Fiber.
   *
   * @param intensity - Intensidad del golpe [0.0 - 1.0] normalizada.
   */
  public triggerMechanicalShock(intensity: number): void {
    const clampedIntensity = Math.min(1.0, Math.max(0.0, intensity));
    this.processShockDetection(
      clampedIntensity,
      120.0 + clampedIntensity * 240.0, // Estimación de frecuencia: 120–360 Hz
      'SEISMIC_TREMOR',
      this.windDeflectionAngle
    );
  }

  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Inyecta una perturbación de RF o pulso de interferencia desde RfSpectrumAnalyzerEngine.
   */
  public injectRfTransient(surgeLevel: number, frequencyMhz: number): void {
    if (surgeLevel >= this.sensitivityThreshold) {
      this.processShockDetection(surgeLevel, frequencyMhz * 1000, 'RF_AMPLITUDE_SURGE', 0.0);
    }
  }

  /**
   * Procesa un evento de choque mecanosensorial y activa el reflejo de escape en GiantFiber si amerita.
   */
  public processShockDetection(
    energy: number,
    freqHz: number,
    source: MechanosensoryShockEvent['sourceType'],
    angleDeg: number
  ): void {
    const now = Date.now();
    // Debounce de choque para evitar ráfagas descontroladas (mínimo 500 ms entre alarmas)
    if (this.lastShock && (now - this.lastShock.timestamp < 500)) {
      return;
    }

    let triggeredReflex = false;
    // Si el choque es crítico, se conecta directamente al arco reflejo de Giant Fiber
    if (energy >= this.sensitivityThreshold) {
      try {
        giantFiberReflex.triggerReflex('EW_JAMMING');
        triggeredReflex = true;
      } catch {}
    }

    this.shockEventsCount++;
    this.lastShock = {
      timestamp: now,
      peakEnergy: Math.round(energy * 100) / 100,
      dominantFrequencyHz: Math.round(freqHz),
      sourceType: source,
      deflectionAngleDeg: Math.round(angleDeg * 10) / 10,
      triggeredReflex,
    };

    this.notifyListeners();
  }

  public setSensitivityThreshold(threshold: number): void {
    this.sensitivityThreshold = Math.min(0.95, Math.max(0.20, threshold));
    this.notifyListeners();
  }

  public getTelemetry(): JohnstonOrganTelemetry {
    return {
      timestamp: Date.now(),
      acousticEnergyLevel: Math.round(this.acousticEnergy * 100) / 100,
      windDeflectionAngleDeg: Math.round(this.windDeflectionAngle * 10) / 10,
      vibrationFrequencyHz: Math.round(this.vibrationFreq),
      joAbResonanceLevel: Math.round(this.joAbResonance * 100) / 100,
      joCeDeflectionLevel: Math.round(this.joCeDeflection * 100) / 100,
      shockEventsCount: this.shockEventsCount,
      lastShockEvent: this.lastShock,
      isListening: this.isListening,
      sensitivityThreshold: this.sensitivityThreshold,
    };
  }

  public subscribe(callback: (telemetry: JohnstonOrganTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const telem = this.getTelemetry();
    for (const listener of this.listeners) {
      try {
        listener(telem);
      } catch {}
    }
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    this.shockEventsCount = 0;
    this.lastShock = null;
    JohnstonOrganEngine.instance = null;
  }
}

export const johnstonOrgan = JohnstonOrganEngine.getInstance();

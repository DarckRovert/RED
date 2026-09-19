/**
 * TacticalMotorActuatorEngine.ts — RED Sovereign Mesh OS
 *
 * Núcleo Motor Descendente y Actuador Háptico Táctico
 * basado en las neuronas descendentes de timoneo DNa01 y DNa02 de Drosophila melanogaster
 * (MaleCNS v1.0, FlyWire Connectome / awesome-fly).
 *
 * Fundamento Biológico:
 * Las neuronas descendentes DNa (Descending Neurons anterior) comunican el Complejo Central (CX)
 * con la Médula Nerviosa Ventral (VNC / motoneuronas de alas y patas):
 * 1. DNa01 / DNa02: Traducen el error de rumbo (steering error) calculado por el Fan-Shaped Body
 *    en modulación asimétrica de amplitud de aleteo para girar a babor (izquierda) o estribor (derecha).
 * 2. Circuito Monosináptico de Escape: Integrado con las motoneuronas de salto TTMn del Giant Fiber
 *    System para maniobras evasivas bruscas ante peligro inminente.
 *
 * Función Táctica en RED Mesh OS:
 * Proporciona guiado somatosensorial háptico al operador mediante secuencias de micro-vibración
 * sin necesidad de encender la pantalla ni emitir luz en operaciones nocturnas o encubiertas:
 * - Rumbo Correcto hacia Home Vector (|error| <= 15°): Pulso sutil de confirmación (40 ms).
 * - Desvío a la Izquierda (error < -30°): Doble pulso asimétrico rápido (40ms, pausa 60ms, 40ms).
 * - Desvío a la Derecha (error > +30°): Pulso sostenido (140 ms).
 * - Alerta de Escape / EW / Colisión (Fibra Gigante activa): Ráfaga de advertencia táctica (200-80-200-80-200 ms).
 */

import { fanShapedBody, FanShapedBodyTelemetry } from './FanShapedBodyEngine';
import { giantFiberReflex, GiantFiberTelemetry } from './GiantFiberReflexEngine';

export type HapticSteeringMode = 'ALIGNED' | 'TURN_LEFT' | 'TURN_RIGHT' | 'EMERGENCY' | 'IDLE';

export interface TacticalMotorActuatorTelemetry {
  timestamp: number;
  dna01IpsilateralExcitation: number;    // [0.0 - 1.0] Neurona de giro izquierda
  dna02ContralateralExcitation: number;  // [0.0 - 1.0] Neurona de giro derecha
  steeringErrorDeg: number;              // Error de rumbo angular (-180° a +180°)
  currentHapticMode: HapticSteeringMode;
  isActuatorEnabled: boolean;
  isTacticalStealthActive: boolean;
  totalPulsesDispatched: number;
  lastVibrationTimestamp: number;
}

export class TacticalMotorActuatorEngine {
  private static instance: TacticalMotorActuatorEngine | null = null;

  // Excitaciones neuronales DNa
  private dna01 = 0.0;
  private dna02 = 0.0;
  private steeringError = 0.0;
  private currentMode: HapticSteeringMode = 'IDLE';

  // Configuración de vibración
  private isEnabled = true;
  private isStealthActive = false;
  private totalPulses = 0;
  private lastVibrateTime = 0;
  private minIntervalMs = 3000; // Máximo 1 pulso de guiado cada 3 segundos

  // Suscripciones a los motores
  private isRunning = false;
  private fbUnsub: (() => void) | null = null;
  private gfsUnsub: (() => void) | null = null;
  private listeners: Set<(telemetry: TacticalMotorActuatorTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): TacticalMotorActuatorEngine {
    if (!TacticalMotorActuatorEngine.instance) {
      TacticalMotorActuatorEngine.instance = new TacticalMotorActuatorEngine();
    }
    return TacticalMotorActuatorEngine.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Acoplar al Fan-Shaped Body para error de timoneo hacia Home / Goal Vector
    this.fbUnsub = fanShapedBody.subscribe((fbTelem: FanShapedBodyTelemetry) => {
      const error = fbTelem.goalVector.hasTarget
        ? fbTelem.goalVector.steeringErrorDeg
        : this.computeHomeSteeringError(fbTelem);

      this.updateSteeringError(error);
    });

    // 2. Acoplar al Giant Fiber Reflex para ráfagas tácticas de colisión / EW
    this.gfsUnsub = giantFiberReflex.subscribe((gfsTelem: GiantFiberTelemetry) => {
      if (gfsTelem.isReflexActive) {
        this.triggerEmergencyBurst();
      }
    });
  }

  public stop(): void {
    this.isRunning = false;
    if (this.fbUnsub) {
      this.fbUnsub();
      this.fbUnsub = null;
    }
    if (this.gfsUnsub) {
      this.gfsUnsub();
      this.gfsUnsub = null;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.notifyListeners();
  }

  public setStealthMode(active: boolean): void {
    this.isStealthActive = active;
    this.notifyListeners();
  }

  /**
   * Calcula el error de timoneo angular respecto al Home Vector.
   */
  private computeHomeSteeringError(fbTelem: FanShapedBodyTelemetry): number {
    const bearing = fbTelem.homeVector.bearingDeg;
    // Rumbo actual inercial
    const currentHeading = ((bearing - fbTelem.goalVector.steeringErrorDeg) % 360 + 360) % 360;
    let diff = (bearing - currentHeading + 180) % 360 - 180;
    if (diff < -180) diff += 360;
    return diff;
  }

  /**
   * Actualiza el error de timoneo y calcula las activaciones de las motoneuronas DNa01/DNa02.
   */
  public updateSteeringError(steeringErrorDeg: number): void {
    this.steeringError = Math.max(-180, Math.min(180, steeringErrorDeg));

    // Decodificación biofísica:
    // Error negativo (<0) = objetivo a la izquierda -> activa DNa01
    // Error positivo (>0) = objetivo a la derecha -> activa DNa02
    if (this.steeringError < 0) {
      this.dna01 = Math.min(1.0, Math.abs(this.steeringError) / 90.0);
      this.dna02 = 0.0;
    } else {
      this.dna02 = Math.min(1.0, this.steeringError / 90.0);
      this.dna01 = 0.0;
    }

    const absError = Math.abs(this.steeringError);
    if (absError <= 15) {
      this.currentMode = 'ALIGNED';
    } else if (this.steeringError < -25) {
      this.currentMode = 'TURN_LEFT';
    } else if (this.steeringError > 25) {
      this.currentMode = 'TURN_RIGHT';
    } else {
      this.currentMode = 'IDLE';
    }

    this.dispatchHapticFeedback();
    this.notifyListeners();
  }

  /**
   * Dispara una ráfaga de vibración táctica de emergencia (colisión inminente / EW).
   */
  public triggerEmergencyBurst(): void {
    this.currentMode = 'EMERGENCY';
    this.executeVibrationPattern([200, 80, 200, 80, 200]);
    this.notifyListeners();
  }

  /**
   * Despacha patrones de vibración basados en el régimen y temporización.
   */
  private dispatchHapticFeedback(): void {
    if (!this.isEnabled) return;
    const now = Date.now();
    if (now - this.lastVibrateTime < this.minIntervalMs) return;

    if (this.currentMode === 'ALIGNED') {
      // Pulso sutil de confirmación de rumbo
      this.executeVibrationPattern(40);
    } else if (this.currentMode === 'TURN_LEFT') {
      // Doble pulso asimétrico para virar a babor
      this.executeVibrationPattern([40, 60, 40]);
    } else if (this.currentMode === 'TURN_RIGHT') {
      // Pulso sostenido para virar a estribor
      this.executeVibrationPattern(140);
    }
  }

  private executeVibrationPattern(pattern: number | number[]): void {
    this.lastVibrateTime = Date.now();
    this.totalPulses++;

    try {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch {}
  }

  public getTelemetry(): TacticalMotorActuatorTelemetry {
    return {
      timestamp: Date.now(),
      dna01IpsilateralExcitation: Math.round(this.dna01 * 100) / 100,
      dna02ContralateralExcitation: Math.round(this.dna02 * 100) / 100,
      steeringErrorDeg: Math.round(this.steeringError * 10) / 10,
      currentHapticMode: this.currentMode,
      isActuatorEnabled: this.isEnabled,
      isTacticalStealthActive: this.isStealthActive,
      totalPulsesDispatched: this.totalPulses,
      lastVibrationTimestamp: this.lastVibrateTime,
    };
  }

  public subscribe(callback: (telemetry: TacticalMotorActuatorTelemetry) => void): () => void {
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
    TacticalMotorActuatorEngine.instance = null;
  }
}

export const tacticalMotorActuator = TacticalMotorActuatorEngine.getInstance();

/**
 * OpticLobeEngine.ts — RED Sovereign Mesh OS
 *
 * Emulación Bio-Neuromórfica de los Lóbulos Ópticos de Drosophila melanogaster
 * (MaleCNS v1.0, FlyWire Connectome / Princeton Murthy Lab / awesome-fly).
 *
 * Fundamento Biológico:
 * Los lóbulos ópticos representan más del 65% de la masa neuronal del cerebro de la mosca
 * (>90,000 neuronas distribuidas en lámina, médula, lóbula y placa de la lóbula):
 * 1. Neuronas T4 / T5: Detectores Elementales de Movimiento (EMD) según el modelo de
 *    Hassenstein-Reichardt (delay-and-correlate):
 *    - T4: Detecta bordes de contraste ON (incremento de luminancia).
 *    - T5: Detecta bordes de contraste OFF (decremento de luminancia).
 * 2. Neuronas Tangenciales de la Placa Lobular (LPTC):
 *    - Células del Sistema Horizontal (HS: HSN, HSE, HSS): Integración espacial del flujo
 *      óptico horizontal para estimar la velocidad angular visual (yaw / rotación de rumbo).
 *    - Células del Sistema Vertical (VS: VS1 a VS6): Integración del flujo óptico vertical
 *      (cabeceo y alabeo / pitch & roll).
 *    - Odometría Visual Traslacional: Vector de desplazamiento (Δx, Δy) para alimentar
 *      el Fan-Shaped Body cuando no hay impacto de pasos (vehículos, drones, lanchas).
 * 3. Neuronas Columnares LC4 / LPLC2 (Looming & Collision Detectors):
 *    - Calculan la tasa de expansión angular relativa de objetos en aproximación:
 *      η(t) = (dθ/dt) * exp(-α * θ(t)) y el Tiempo de Contacto (TTC = θ / (dθ/dt)).
 *    - Al superar el umbral crítico de colisión, disparan el arco reflejo monosináptico
 *      en GiantFiberReflexEngine ('VISUAL_LOOMING_THREAT') en < 5 ms.
 */

import { giantFiberReflex } from './GiantFiberReflexEngine';
import { fanShapedBody } from './FanShapedBodyEngine';
import { ringAttractor } from './RingAttractorEngine';

export interface OpticFlowVector {
  dx: number; // Flujo horizontal [-1.0 a +1.0] (Positivo = Derecha, Negativo = Izquierda)
  dy: number; // Flujo vertical [-1.0 a +1.0] (Positivo = Arriba, Negativo = Abajo)
  magnitude: number;
  angleRad: number;
}

export interface LoomingThreatAssessment {
  isThreatDetected: boolean;
  expansionRate: number;      // Tasa de expansión angular relativa dθ/dt
  angularSizeDeg: number;     // Tamaño angular aparente del objeto
  estimatedTtcMs: number;     // Tiempo estimado hasta colisión (Time to Contact)
  threatIntensity: number;    // [0.0 - 1.0]
  lastAlertTimestamp: number;
}

export interface OpticLobeTelemetry {
  timestamp: number;
  gridWidth: number;          // 16 columnas de omatidios
  gridHeight: number;         // 16 filas de omatidios
  totalOmmatidiaCount: number; // 256 receptores
  // Respuestas del correlador T4/T5
  t4OnMotionMagnitude: number;
  t5OffMotionMagnitude: number;
  // Células tangenciales LPTC
  hsHorizontalMotion: number; // [-1.0 a 1.0] (Rotación angular visual)
  vsVerticalMotion: number;   // [-1.0 a 1.0] (Pitch/Roll visual)
  visualAngularVelocityDegPerSec: number;
  translationalFlow: OpticFlowVector;
  // Odometría visual acumulada
  visualOdometryDistanceMeters: number;
  // Detector de colisión LC4 / LPLC2
  loomingThreat: LoomingThreatAssessment;
  // Estado de procesamiento
  fpsProcessed: number;
  isProcessingActive: boolean;
  totalFramesProcessed: number;
}

export class OpticLobeEngine {
  private static instance: OpticLobeEngine | null = null;

  public static readonly GRID_WIDTH = 16;
  public static readonly GRID_HEIGHT = 16;
  public static readonly TOTAL_OMMATIDIA = 256; // 16 * 16

  // Buffers temporales de luminancia para correlación H-R
  private currentFrame: Float32Array;
  private previousFrame: Float32Array;
  private hasPreviousFrame = false;
  private lastFrameTimestamp = 0;

  // Parámetros del correlador de Hassenstein-Reichardt
  private tauDelayMs = 33; // ~30 FPS por defecto (33 ms)
  private visualOdometryAccumDistance = 0.0;
  private totalFramesProcessed = 0;
  private fpsCounter = 0;
  private lastFpsCalcTime = 0;
  private measuredFps = 30;

  // Estado del sistema LPTC
  private hsResponse = 0.0;
  private vsResponse = 0.0;
  private t4Response = 0.0;
  private t5Response = 0.0;
  private visualAngularVelDegSec = 0.0;
  private translationalVector: OpticFlowVector = { dx: 0, dy: 0, magnitude: 0, angleRad: 0 };

  // Estado del detector de amenaza LC4 / LPLC2
  private lastObjectRadius = 0.0;
  private loomingThreatState: LoomingThreatAssessment = {
    isThreatDetected: false,
    expansionRate: 0.0,
    angularSizeDeg: 0.0,
    estimatedTtcMs: 9999,
    threatIntensity: 0.0,
    lastAlertTimestamp: 0,
  };

  private isRunning = false;
  private listeners: Set<(telemetry: OpticLobeTelemetry) => void> = new Set();

  private constructor() {
    this.currentFrame = new Float32Array(OpticLobeEngine.TOTAL_OMMATIDIA);
    this.previousFrame = new Float32Array(OpticLobeEngine.TOTAL_OMMATIDIA);
  }

  public static getInstance(): OpticLobeEngine {
    if (!OpticLobeEngine.instance) {
      OpticLobeEngine.instance = new OpticLobeEngine();
    }
    return OpticLobeEngine.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFpsCalcTime = Date.now();
  }

  public stop(): void {
    this.isRunning = false;
    this.hasPreviousFrame = false;
  }

  /**
   * Ingiere un cuadro de luminancia normalizado [0.0 - 1.0] sobre la matriz de omatidios 16x16.
   * Ejecuta la computación Hassenstein-Reichardt T4/T5 y la evaluación LC4 en sub-milisegundos.
   */
  public ingestVisualFrame(
    luminanceData: ArrayLike<number>,
    timestamp: number = Date.now()
  ): OpticLobeTelemetry {
    const len = Math.min(luminanceData.length, OpticLobeEngine.TOTAL_OMMATIDIA);
    
    // Si tenemos cuadro anterior, rotar buffer
    if (this.hasPreviousFrame) {
      this.previousFrame.set(this.currentFrame);
    }

    for (let i = 0; i < len; i++) {
      this.currentFrame[i] = Math.max(0.0, Math.min(1.0, luminanceData[i] || 0.0));
    }

    const dtMs = this.lastFrameTimestamp > 0 
      ? Math.max(5, timestamp - this.lastFrameTimestamp) 
      : this.tauDelayMs;
    this.lastFrameTimestamp = timestamp;

    this.totalFramesProcessed++;
    this.fpsCounter++;
    if (timestamp - this.lastFpsCalcTime >= 1000) {
      this.measuredFps = this.fpsCounter;
      this.fpsCounter = 0;
      this.lastFpsCalcTime = timestamp;
    }

    if (!this.hasPreviousFrame) {
      this.hasPreviousFrame = true;
      return this.getTelemetry();
    }

    // ── 1. Correlador Hassenstein-Reichardt T4/T5 ──────────────────────────────
    let sumDx = 0.0;
    let sumDy = 0.0;
    let sumT4 = 0.0;
    let sumT5 = 0.0;
    let correlationPairs = 0;

    const W = OpticLobeEngine.GRID_WIDTH;
    const H = OpticLobeEngine.GRID_HEIGHT;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const curr = this.currentFrame[idx];
        const prev = this.previousFrame[idx];
        const deltaL = curr - prev;

        // Separación de vías de contraste ON (T4) y OFF (T5)
        if (deltaL > 0) sumT4 += deltaL;
        else sumT5 += Math.abs(deltaL);

        // Correlación horizontal: I(x, y, t) * I(x+1, y, t-τ) - I(x+1, y, t) * I(x, y, t-τ)
        if (x + 1 < W) {
          const idxRight = y * W + (x + 1);
          const currR = this.currentFrame[idxRight];
          const prevR = this.previousFrame[idxRight];
          const hFlow = (curr * prevR) - (currR * prev);
          sumDx += hFlow;
          correlationPairs++;
        }

        // Correlación vertical: I(x, y, t) * I(x, y+1, t-τ) - I(x, y+1, t) * I(x, y, t-τ)
        if (y + 1 < H) {
          const idxDown = (y + 1) * W + x;
          const currD = this.currentFrame[idxDown];
          const prevD = this.previousFrame[idxDown];
          const vFlow = (curr * prevD) - (currD * prev);
          sumDy += vFlow;
        }
      }
    }

    const normFactor = correlationPairs > 0 ? correlationPairs : 1;
    this.hsResponse = Math.max(-1.0, Math.min(1.0, (sumDx / normFactor) * 8.0));
    this.vsResponse = Math.max(-1.0, Math.min(1.0, (sumDy / normFactor) * 8.0));
    this.t4Response = Math.max(0.0, Math.min(1.0, sumT4 / OpticLobeEngine.TOTAL_OMMATIDIA));
    this.t5Response = Math.max(0.0, Math.min(1.0, sumT5 / OpticLobeEngine.TOTAL_OMMATIDIA));

    // Velocidad angular visual aproximada (deg/s)
    this.visualAngularVelDegSec = Math.round(this.hsResponse * 120.0 * 10) / 10;

    // Vector traslacional de flujo óptico
    const mag = Math.sqrt(this.hsResponse * this.hsResponse + this.vsResponse * this.vsResponse);
    this.translationalVector = {
      dx: Math.round(this.hsResponse * 100) / 100,
      dy: Math.round(this.vsResponse * 100) / 100,
      magnitude: Math.round(mag * 100) / 100,
      angleRad: Math.atan2(this.vsResponse, this.hsResponse),
    };

    // Integración de odometría visual si hay traslación significativa
    const stepMeters = mag * (dtMs / 1000.0) * 1.5; // Escala empírica ~1.5 m/s máx
    if (stepMeters > 0.005) {
      this.visualOdometryAccumDistance += stepMeters;
    }

    // ── 2. Detector de Looming y Colisión LC4 / LPLC2 ──────────────────────────
    this.evaluateLoomingThreat(dtMs);

    this.notifyListeners();
    return this.getTelemetry();
  }

  /**
   * Evaluación de expansión angular centrada (Looming Detector LC4/LPLC2).
   */
  private evaluateLoomingThreat(dtMs: number): void {
    const W = OpticLobeEngine.GRID_WIDTH;
    const H = OpticLobeEngine.GRID_HEIGHT;
    const centerX = (W - 1) / 2;
    const centerY = (H - 1) / 2;

    // Medir radio cuadrático ponderado de activación oscura/contrastada desde el centro
    let weightedRadiusSum = 0.0;
    let totalMass = 0.0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const val = this.currentFrame[y * W + x];
        // En Drosophila, los estímulos de amenaza (looming) suelen ser sombras oscuras en expansión
        const contrast = 1.0 - val;
        if (contrast > 0.25) {
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          weightedRadiusSum += dist * contrast;
          totalMass += contrast;
        }
      }
    }

    const currentRadius = totalMass > 0.1 ? (weightedRadiusSum / totalMass) : 0.0;
    const currentAngularSizeDeg = Math.min(180, (currentRadius / (W / 2)) * 90.0);

    if (this.lastObjectRadius > 0.1 && currentRadius > this.lastObjectRadius) {
      const dRadius = currentRadius - this.lastObjectRadius;
      const dtSec = dtMs / 1000.0;
      const expansionRate = dtSec > 0 ? (dRadius / dtSec) : 0.0;

      // Tiempo de contacto: TTC = θ / (dθ/dt)
      const ttcSec = expansionRate > 0.05 ? (currentRadius / expansionRate) : 9999;
      const ttcMs = Math.round(ttcSec * 1000);

      // Umbral crítico: expansión rápida y colisión inminente en menos de 500 ms
      const isCritical = expansionRate >= 1.2 && ttcMs <= 500;
      const intensity = Math.min(1.0, Math.max(0.0, (expansionRate / 3.0) + (1.0 - Math.min(1.0, ttcMs / 1000))));

      this.loomingThreatState = {
        isThreatDetected: isCritical,
        expansionRate: Math.round(expansionRate * 100) / 100,
        angularSizeDeg: Math.round(currentAngularSizeDeg * 10) / 10,
        estimatedTtcMs: Math.max(10, ttcMs),
        threatIntensity: Math.round(intensity * 100) / 100,
        lastAlertTimestamp: isCritical ? Date.now() : this.loomingThreatState.lastAlertTimestamp,
      };

      // Disparo automático del arco reflejo de escape en GiantFiberReflexEngine
      if (isCritical) {
        console.warn(`[OpticLobe] 🚨 LC4 Looming Threat Triggered: Expansion ${this.loomingThreatState.expansionRate}/s, TTC: ${ttcMs}ms`);
        try {
          giantFiberReflex.triggerReflex('VISUAL_LOOMING_THREAT');
        } catch (e) {
          console.error('[OpticLobe] Error al disparar reflejo de fibra gigante:', e);
        }
      }
    } else {
      this.loomingThreatState.isThreatDetected = false;
      this.loomingThreatState.threatIntensity = Math.max(0.0, this.loomingThreatState.threatIntensity * 0.85);
    }

    this.lastObjectRadius = currentRadius;
  }

  /**
   * Inyecta un estímulo sintético de aproximación / colisión (útil en pruebas de laboratorio y drills).
   */
  public injectSyntheticLoomingStimulus(targetSizeDeg: number, expansionRate: number): boolean {
    const isCritical = expansionRate >= 1.2;
    const ttcMs = expansionRate > 0 ? Math.round((targetSizeDeg / expansionRate) * 10) : 150;
    
    this.loomingThreatState = {
      isThreatDetected: isCritical,
      expansionRate: Math.round(expansionRate * 100) / 100,
      angularSizeDeg: targetSizeDeg,
      estimatedTtcMs: ttcMs,
      threatIntensity: isCritical ? 0.95 : 0.40,
      lastAlertTimestamp: Date.now(),
    };

    if (isCritical) {
      giantFiberReflex.triggerReflex('VISUAL_LOOMING_THREAT');
    }

    this.notifyListeners();
    return isCritical;
  }

  public getTelemetry(): OpticLobeTelemetry {
    return {
      timestamp: Date.now(),
      gridWidth: OpticLobeEngine.GRID_WIDTH,
      gridHeight: OpticLobeEngine.GRID_HEIGHT,
      totalOmmatidiaCount: OpticLobeEngine.TOTAL_OMMATIDIA,
      t4OnMotionMagnitude: Math.round(this.t4Response * 100) / 100,
      t5OffMotionMagnitude: Math.round(this.t5Response * 100) / 100,
      hsHorizontalMotion: this.hsResponse,
      vsVerticalMotion: this.vsResponse,
      visualAngularVelocityDegPerSec: this.visualAngularVelDegSec,
      translationalFlow: this.translationalVector,
      visualOdometryDistanceMeters: Math.round(this.visualOdometryAccumDistance * 100) / 100,
      loomingThreat: { ...this.loomingThreatState },
      fpsProcessed: this.measuredFps,
      isProcessingActive: this.isRunning,
      totalFramesProcessed: this.totalFramesProcessed,
    };
  }

  public subscribe(callback: (telemetry: OpticLobeTelemetry) => void): () => void {
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
    OpticLobeEngine.instance = null;
  }
}

export const opticLobe = OpticLobeEngine.getInstance();

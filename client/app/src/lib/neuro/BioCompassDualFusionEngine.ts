/**
 * BioCompassDualFusionEngine.ts — RED Sovereign Mesh OS
 *
 * Emulación y Fusión Bio-Cibernética Dual:
 * 1. Complejo Central (CX) de Drosophila melanogaster (Fan-Shaped Body 16x9 + E-PG Ring Attractor).
 * 2. Corteza Entorrinal Medial Humana (MEC 4-Scale Hexagonal Grid Cells) & Anclaje Hipocampal CA3.
 *
 * Fundamentos Neurobiológicos & Robóticos:
 * - El Fan-Shaped Body (Stone et al., Nature 2017) proporciona cinemática vectorial instantánea en 3D:
 *   rumbo azimutal continuo, integración de zancada egocéntrica a alocéntrica y decodificación
 *   de motoneuronas de giro DNa01/DNa02.
 * - La Corteza Entorrinal (Moser & Moser, Nobel 2014) proporciona cuantización topológica periódica
 *   multiescala (λ = 0.5m, 2.0m, 8.0m, 32.0m) con simetría rómbico-hexagonal de 60°.
 * - El Complejo Hipocampal DG/CA3 ejecuta pattern completion autoasociativo sobre engramas episódicos
 *   cuando el operador o robot móvil se aproxima a un nodo o landmark conocido, induciendo un reseteo
 *   de deriva espacial a 0.0m.
 * - Cierra el bucle de control de navegación autónoma con el Generador de Patrones Centrales (CPG)
 *   hexápodo y difunde micro-espigas AER (14B, AerDomainCode.CX_COMPASS_HEADING) en malla LoRa/BLE.
 */

import { fanShapedBody, FanShapedBodyTelemetry, HomeVectorSolution, GoalVectorSolution } from './FanShapedBodyEngine';
import { ringAttractor, RingAttractorTelemetry } from './RingAttractorEngine';
import { entorhinalGridCell, EntorhinalGridCellEngine, EntorhinalTelemetry, GridModuleTelemetry } from './human/EntorhinalGridCellEngine';
import { hippocampalEpisodic } from './human/HippocampalEpisodicEngine';
import { tacticalMotorActuator } from './TacticalMotorActuatorEngine';
import { centralPatternGenerator } from './CentralPatternGeneratorEngine';
import { meshRouter } from '../mesh/meshRouter';
import { AerDomainCode } from '../mesh/meshProtocol';

export type PhaseCoherenceState = 'HARMONIC_CONSENSUS' | 'NOMINAL' | 'DRIFT_WARNING';

export type AutonomousCpgSteeringState = 'FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'ARRIVED' | 'STANDBY';

export interface BioCompassDualTelemetry {
  timestamp: number;
  headingDeg: number;
  cardinal: string;
  currentPosition: {
    xMeters: number;
    yMeters: number;
    zMeters: number;
  };
  totalDistanceTraveledMeters: number;
  homeVector: HomeVectorSolution;
  goalVector: GoalVectorSolution;
  gridCellActivity: {
    modules: GridModuleTelemetry[];
    compositeActivity: number;
  };
  phaseCoherence: number; // [0.0 - 1.0] Índice de consenso entre FB y MEC
  phaseCoherenceState: PhaseCoherenceState;
  estimatedDriftMeters: number;
  hippocampalResetsCount: number;
  fusedSteeringErrorDeg: number; // [-180° .. +180°] Error combinado ponderado
  autonomousCpgSteering: AutonomousCpgSteeringState;
  isSensoryLocked: boolean;
  isAutonomousNavigationActive: boolean;
  lastAerSpikeBroadcastAt: number;
}

export class BioCompassDualFusionEngine {
  private static instance: BioCompassDualFusionEngine | null = null;

  public static readonly AER_REFRACTORY_PERIOD_MS = 500; // Máximo 2 espigas/segundo (preservación espectral LoRa TDMA)
  public static readonly UI_THROTTLE_MS = 66; // 15 Hz (~66ms) cadencia óptima anti-saturación de CPU

  private isRunning = false;
  private isAutonomousNavActive = false;
  private hippocampalResetsCount = 0;
  private lastAerSpikeBroadcastAt = 0;
  private lastBroadcastHeading = -999;
  private lastNotifyTime = 0;
  private notifyThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  private unsubs: Array<() => void> = [];
  private listeners: Set<(telemetry: BioCompassDualTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): BioCompassDualFusionEngine {
    if (!BioCompassDualFusionEngine.instance) {
      BioCompassDualFusionEngine.instance = new BioCompassDualFusionEngine();
    }
    return BioCompassDualFusionEngine.instance;
  }

  /**
   * Calcula la distancia angular geodésica mínima entre dos rumbos sobre la circunferencia S^1 [0° .. 180°].
   */
  public static computeCircularDifference(degA: number, degB: number): number {
    if (!isFinite(degA) || !isFinite(degB)) return 0;
    const diff = Math.abs(((degA - degB + 540) % 360) - 180);
    return Math.round(diff * 10) / 10;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Iniciar subsistemas si no están corriendo
    fanShapedBody.start();
    entorhinalGridCell.start();

    // 1. Suscripción a RingAttractor para cambios de rumbo azimutal E-PG
    const unsubRing = ringAttractor.subscribe((ringTelem: RingAttractorTelemetry) => {
      // Disparar micro-espiga AER táctica si el rumbo viró >= 30° respecto al último broadcast en la métrica circular S^1
      const headingDiff = this.lastBroadcastHeading === -999
        ? 30
        : BioCompassDualFusionEngine.computeCircularDifference(ringTelem.headingDeg, this.lastBroadcastHeading);

      if (headingDiff >= 30) {
        this.broadcastAerHeadingSpike(ringTelem.headingDeg);
      }
      this.evaluateClosedLoopSteering();
      this.notifyListeners();
    });

    // 2. Suscripción reactiva a Fan-Shaped Body (la odometría de pasos se ingesta directamente en FB)
    const unsubFb = fanShapedBody.subscribe(() => {
      this.evaluateClosedLoopSteering();
      this.notifyListeners();
    });

    // 3. Suscripción reactiva a Entorhinal Grid Cells (la odometría de pasos se ingesta directamente en MEC)
    const unsubMec = entorhinalGridCell.subscribe(() => {
      this.notifyListeners();
    });

    this.unsubs.push(unsubRing, unsubFb, unsubMec);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.notifyThrottleTimer) {
      clearTimeout(this.notifyThrottleTimer);
      this.notifyThrottleTimer = null;
    }
    this.unsubs.forEach((u) => {
      try { u(); } catch {}
    });
    this.unsubs = [];
  }

  /**
   * Integra el desplazamiento inercial de forma sincronizada en:
   * - FanShapedBody (16 columnas x 9 capas).
   * - EntorhinalGridCells (4 escalas modulares con ondas a 0°, 60°, 120°).
   */
  public integrateMotion(deltaDistanceMeters: number, headingDeg: number, deltaZMeters = 0.0): void {
    if (!isFinite(deltaDistanceMeters) || deltaDistanceMeters <= 0.001 || !isFinite(headingDeg)) return;

    // 1. Integración en insecto (FanShapedBody)
    fanShapedBody.integrateStep(deltaDistanceMeters, headingDeg, deltaZMeters);

    // 2. Integración en mamífero (EntorhinalGridCells)
    entorhinalGridCell.integrateMotion(deltaDistanceMeters, headingDeg);

    this.evaluateClosedLoopSteering();
    this.notifyListeners();
  }

  /**
   * Calcula el Índice de Coherencia de Fase (C_coherence) entre la odometría cartesiana
   * del Fan-Shaped Body y las teselaciones hexagonales de la Corteza Entorrinal.
   * C_coherence = 1/4 * ∑_{m=1}^4 ψ_m(x_FB, y_FB) ∈ [0.0, 1.0]
   */
  public calculatePhaseCoherence(): number {
    const fbTelem = fanShapedBody.getTelemetry();
    const x = fbTelem.currentPosition.xMeters;
    const y = fbTelem.currentPosition.yMeters;

    let total = 0.0;
    const wavelengths = EntorhinalGridCellEngine.WAVELENGTHS;
    for (let m = 0; m < wavelengths.length; m++) {
      total += entorhinalGridCell.calculateHexagonalActivation(m, x, y);
    }
    const mean = total / wavelengths.length;
    return Math.max(0.0, Math.min(1.0, Math.round(mean * 100) / 100));
  }

  /**
   * Computa el vector de timoneo combinado (Dual Fused Steering Vector) ponderando
   * la cinemática vectorial del Fan-Shaped Body con el gradiente topológico de la Corteza Entorrinal.
   */
  public getFusedSteeringSolution(cachedCoherence?: number): {
    fusedSteeringErrorDeg: number;
    steeringMode: AutonomousCpgSteeringState;
    distanceMeters: number;
    bearingDeg: number;
  } {
    const fbTelem = fanShapedBody.getTelemetry();
    const hasTarget = fbTelem.goalVector.hasTarget;

    const targetVector = hasTarget ? fbTelem.goalVector : {
      distanceMeters: fbTelem.homeVector.distanceMeters,
      bearingDeg: fbTelem.homeVector.bearingDeg,
      steeringErrorDeg: this.computeHeadingDifference(fbTelem.homeVector.bearingDeg, ringAttractor.getTelemetry().headingDeg),
    };

    if (targetVector.distanceMeters < 0.5) {
      return {
        fusedSteeringErrorDeg: 0,
        steeringMode: 'ARRIVED',
        distanceMeters: targetVector.distanceMeters,
        bearingDeg: targetVector.bearingDeg,
      };
    }

    const coherence = (typeof cachedCoherence === 'number' && Number.isFinite(cachedCoherence))
      ? cachedCoherence
      : this.calculatePhaseCoherence();
    // Peso asignado al Fan-Shaped Body (mayor cuanto mayor sea la coherencia armónica)
    const wFb = 0.70 * coherence + 0.30;
    const wTopo = 1.0 - wFb;

    // Error azimutal FB
    const errorFb = targetVector.steeringErrorDeg;

    // Gradiente topológico entorrinal hacia la miga de pan o target
    const currentHeading = ringAttractor.getTelemetry().headingDeg;
    const errorMec = this.computeHeadingDifference(targetVector.bearingDeg, currentHeading);

    let fusedError = wFb * errorFb + wTopo * errorMec;
    while (fusedError > 180) fusedError -= 360;
    while (fusedError < -180) fusedError += 360;
    fusedError = Math.round(fusedError * 10) / 10;

    let mode: AutonomousCpgSteeringState = 'FORWARD';
    if (fusedError < -12) {
      mode = 'TURN_LEFT';
    } else if (fusedError > 12) {
      mode = 'TURN_RIGHT';
    } else {
      mode = 'FORWARD';
    }

    return {
      fusedSteeringErrorDeg: fusedError,
      steeringMode: mode,
      distanceMeters: targetVector.distanceMeters,
      bearingDeg: targetVector.bearingDeg,
    };
  }

  /**
   * Bucle cerrado de control: acopla la solución de timoneo del Compás Dual con
   * el Generador de Patrones Centrales (CPG) hexápodo si la navegación autónoma está activa.
   */
  private evaluateClosedLoopSteering(): void {
    if (!this.isAutonomousNavActive) return;

    const solution = this.getFusedSteeringSolution();
    if (solution.steeringMode === 'ARRIVED') {
      centralPatternGenerator.setLocomotionDrive(0.0, 0.0);
      return;
    }

    // Normalizar sesgo de timoneo [-1.0 .. +1.0]
    const turnBias = Math.max(-1.0, Math.min(1.0, solution.fusedSteeringErrorDeg / 90.0));
    const speed = solution.steeringMode === 'FORWARD' ? 0.5 : 0.25;

    centralPatternGenerator.setLocomotionDrive(speed, turnBias);
    tacticalMotorActuator.updateSteeringError(solution.fusedSteeringErrorDeg);
  }

  /**
   * Fija un objetivo táctico tridimensional relativo en metros.
   */
  public setGuidanceGoal(xMeters: number, yMeters: number, zMeters = 0.0): void {
    fanShapedBody.setTarget(xMeters, yMeters, zMeters);
    this.evaluateClosedLoopSteering();
    this.notifyListeners(true);
  }

  /**
   * Elimina el objetivo táctico activo.
   */
  public clearGuidanceGoal(): void {
    fanShapedBody.clearTarget();
    if (this.isAutonomousNavActive) {
      centralPatternGenerator.setLocomotionDrive(0.0, 0.0);
    }
    this.notifyListeners(true);
  }

  /**
   * Establece el punto de origen / nido (Home Datum).
   */
  public setHomeDatum(x?: number, y?: number, z?: number): void {
    fanShapedBody.setHomeOrigin(x, y, z);
    this.notifyListeners(true);
  }

  /**
   * Anclaje Episódico Hipocampal & Reseteo de Deriva Inercial a 0.0m.
   * Se ejecuta al reconocer un landmark, baliza fija de radio malla o engrama CA3 previo.
   */
  public correctSpatialDrift(referenceX: number, referenceY: number, referenceZ = 0.0, label = 'ANCLAJE DE NODO'): void {
    this.hippocampalResetsCount++;

    // 1. Reconciliar coordenadas en insecto (Fan-Shaped Body)
    fanShapedBody.reconcileCoordinates(referenceX, referenceY, referenceZ);

    // 2. Reconciliar fases y anular deriva en mamífero (Entorhinal Grid Cells)
    entorhinalGridCell.correctSpatialDrift(referenceX, referenceY, referenceZ, label);

    // 3. Registrar engrama episódico en Hipocampo
    try {
      hippocampalEpisodic.memorizePacket({
        id: `ANCHOR-${Date.now().toString(36).toUpperCase()}`,
        senderPeerId: 'BIO-COMPASS-ANCHOR',
        channel: 'CH_COMPASS',
        payloadType: 'SPATIAL_ANCHOR',
        geohashPrefix: `${Math.round(referenceX)},${Math.round(referenceY)}`,
        summary: `Anclaje hipocampal en [${referenceX}m, ${referenceY}m, ${referenceZ}m] (${label})`,
      });
    } catch {}

    this.evaluateClosedLoopSteering();
    this.notifyListeners(true);
  }

  /**
   * Activa o desactiva la navegación autónoma de bucle cerrado hacia el objetivo.
   */
  public setAutonomousNavigation(enabled: boolean): void {
    this.isAutonomousNavActive = enabled;
    if (!enabled) {
      centralPatternGenerator.setLocomotionDrive(0.0, 0.0);
    } else {
      this.evaluateClosedLoopSteering();
    }
    this.notifyListeners(true);
  }

  /**
   * Difunde una micro-espiga neuromórfica AER (14 bytes) con el rumbo azimutal actual
   * a través de la radio malla LoRa/BLE con control de período refractario.
   */
  public async broadcastAerHeadingSpike(heading = ringAttractor.getTelemetry().headingDeg): Promise<void> {
    const now = Date.now();
    if (this.lastBroadcastHeading !== -999 && (now - this.lastAerSpikeBroadcastAt < BioCompassDualFusionEngine.AER_REFRACTORY_PERIOD_MS)) {
      return;
    }
    try {
      const headingInt = Math.round(((heading % 360) + 360) % 360);
      await meshRouter.broadcastAerSpike(AerDomainCode.CX_COMPASS_HEADING, 0, headingInt);
      this.lastAerSpikeBroadcastAt = now;
      this.lastBroadcastHeading = headingInt;
    } catch {}
  }

  public getTelemetry(): BioCompassDualTelemetry {
    const ringTelem = ringAttractor.getTelemetry();
    const fbTelem = fanShapedBody.getTelemetry();
    const mecTelem = entorhinalGridCell.getTelemetry();
    const coherence = this.calculatePhaseCoherence();
    const steeringSol = this.getFusedSteeringSolution(coherence);

    let coherenceState: PhaseCoherenceState = 'NOMINAL';
    if (coherence >= 0.55) {
      coherenceState = 'HARMONIC_CONSENSUS';
    } else if (coherence < 0.35) {
      coherenceState = 'DRIFT_WARNING';
    }

    return {
      timestamp: Date.now(),
      headingDeg: ringTelem.headingDeg,
      cardinal: ringTelem.cardinal,
      currentPosition: {
        xMeters: fbTelem.currentPosition.xMeters,
        yMeters: fbTelem.currentPosition.yMeters,
        zMeters: fbTelem.currentPosition.zMeters,
      },
      totalDistanceTraveledMeters: fbTelem.totalDistanceTraveledMeters,
      homeVector: fbTelem.homeVector,
      goalVector: fbTelem.goalVector,
      gridCellActivity: {
        modules: mecTelem.modules,
        compositeActivity: mecTelem.compositeGridActivity,
      },
      phaseCoherence: coherence,
      phaseCoherenceState: coherenceState,
      estimatedDriftMeters: mecTelem.estimatedDriftMeters,
      hippocampalResetsCount: this.hippocampalResetsCount,
      fusedSteeringErrorDeg: steeringSol.fusedSteeringErrorDeg,
      autonomousCpgSteering: this.isAutonomousNavActive ? steeringSol.steeringMode : 'STANDBY',
      isSensoryLocked: ringTelem.isSensoryAnchored && fbTelem.isSensoryLocked,
      isAutonomousNavigationActive: this.isAutonomousNavActive,
      lastAerSpikeBroadcastAt: this.lastAerSpikeBroadcastAt,
    };
  }

  public subscribe(callback: (telemetry: BioCompassDualTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
    };
  }

  private notifyListeners(force = false): void {
    if (!this.isRunning || this.listeners.size === 0) return;
    const now = Date.now();
    const elapsed = now - this.lastNotifyTime;

    if (force || elapsed >= BioCompassDualFusionEngine.UI_THROTTLE_MS) {
      if (this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
      this.lastNotifyTime = now;
      this.dispatchTelemetry();
    } else if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        if (!this.isRunning || this.listeners.size === 0) return;
        this.lastNotifyTime = Date.now();
        this.dispatchTelemetry();
      }, BioCompassDualFusionEngine.UI_THROTTLE_MS - elapsed);
    }
  }

  private dispatchTelemetry(): void {
    if (this.listeners.size === 0) return;
    const telem = this.getTelemetry();
    for (const listener of this.listeners) {
      try { listener(telem); } catch {}
    }
  }

  private computeHeadingDifference(bearing: number, currentHeading: number): number {
    if (!isFinite(bearing) || !isFinite(currentHeading)) return 0;
    const diff = ((bearing - currentHeading) % 360 + 540) % 360 - 180;
    return Math.round(diff * 10) / 10;
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    BioCompassDualFusionEngine.instance = null;
  }
}

export const bioCompassDualFusion = BioCompassDualFusionEngine.getInstance();

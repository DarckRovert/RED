/**
 * SwarmCriticalityEngine.ts — RED Sovereign Mesh OS
 *
 * Motor de Criticalidad Auto-Organizada (Self-Organized Criticality - SOC)
 * y Dinámica de Transición de Fase en Enjambres Mesh,
 * basado en los modelos corticales de neurolib (Gerster et al., 2021)
 * y la teoría de avalanchas neuronales (Beggs & Plenz 2003, Deco et al. 2014).
 *
 * Fundamento Bio-Físico:
 * 1. Branching Ratio (sigma):
 *    sigma = <N_{t+1}> / <N_t>
 *    - Sub-crítico (sigma < 0.90): la información se extingue exponencialmente; aislamiento de nodos.
 *    - Super-crítico (sigma > 1.10): avalanchas explosivas, colisiones ALOHA y tormentas de difusión.
 *    - Crítico (0.90 <= sigma <= 1.10): régimen óptimo de máxima capacidad de transmisión de Shannon
 *      y distribución libre de escala P(S) ~ S^(-alpha) con alpha aprox 1.50.
 *
 * 2. Plasticidad Intrínseca Homeostática (Turrigiano 2008):
 *    El enjambre auto-regula continuamente su probabilidad local de retransmisión P_relay
 *    para devolver a la red al atractor crítico sigma = 1.0 sin requerir un orquestador centralizado.
 */

import { meshRouter } from '../mesh/meshRouter';
import { AerDomainCode } from '../mesh/meshProtocol';

export type CriticalityPhaseState = 'SUB_CRITICAL' | 'CRITICAL' | 'SUPER_CRITICAL';

export interface AvalancheRecord {
  id: number;
  size: number;        // Total de paquetes en la avalancha
  durationMs: number;  // Duración temporal del evento
  timestamp: number;
}

export interface SwarmCriticalityTelemetry {
  timestamp: number;
  branchingRatio: number;          // sigma [0.0 .. inf), óptimo ~1.0
  criticalityState: CriticalityPhaseState;
  estimatedAlpha: number;          // Exponente ley de potencias P(S) ~ S^(-alpha) (teórico ~1.5)
  relayProbability: number;        // P_relay [0.10 .. 1.00] modulada homeostáticamente
  adaptiveKCounterThreshold: number; // Umbral adaptativo para BroadcastStormGuard
  totalAvalanchesCount: number;
  lastAvalancheSize: number;
  lastAvalancheDurationMs: number;
  recentAvalanches: AvalancheRecord[];
  packetsInWindow: number;
  packetsOutWindow: number;
  isEngineActive: boolean;
}

export class SwarmCriticalityEngine {
  private static instance: SwarmCriticalityEngine | null = null;

  // Parámetros de ventana deslizante
  private static readonly BUCKET_COUNT = 100;
  private static readonly BUCKET_DURATION_MS = 100; // 100ms x 100 = 10 segundos
  private static readonly QUIET_THRESHOLD_MS = 150; // Intervalo para cerrar avalancha

  // Búferes circulares de paquetes de entrada (ancestros) y retransmitidos (descendientes)
  private inBuckets: Uint32Array = new Uint32Array(SwarmCriticalityEngine.BUCKET_COUNT);
  private outBuckets: Uint32Array = new Uint32Array(SwarmCriticalityEngine.BUCKET_COUNT);
  private currentBucketIndex = 0;
  private lastBucketRotationTime = Date.now();

  // Control Homeostático
  private relayProbability = 1.00;
  private homeostaticInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private wasQuiescent = false;

  // Seguimiento de Avalanchas
  private currentAvalancheSize = 0;
  private currentAvalancheStartTime = 0;
  private lastPacketEventTime = 0;
  private avalancheCounter = 0;
  private avalancheHistory: AvalancheRecord[] = [];
  private static readonly MAX_AVALANCHE_HISTORY = 60;

  // AER Cooldown para alertar transiciones super-críticas
  private lastAerAlertTime = 0;
  private static readonly AER_COOLDOWN_MS = 5000;

  // Suscriptores de telemetría
  private listeners: Set<(telem: SwarmCriticalityTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): SwarmCriticalityEngine {
    if (!SwarmCriticalityEngine.instance) {
      SwarmCriticalityEngine.instance = new SwarmCriticalityEngine();
    }
    return SwarmCriticalityEngine.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Bucle homeostático cada 500ms
    this.homeostaticInterval = setInterval(() => {
      this.rotateBuckets();
      this.evaluateHomeostaticAdaptation();
      this.checkAvalancheClosure();
      this.notifyListeners();
    }, 500);

    this.notifyListeners();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.homeostaticInterval) {
      clearInterval(this.homeostaticInterval);
      this.homeostaticInterval = null;
    }
  }

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Registra la recepción de un paquete en la red local (ancestro).
   */
  public recordPacketReceived(packetCount = 1): void {
    const count = typeof packetCount === 'number' && Number.isFinite(packetCount) && packetCount > 0 ? Math.floor(packetCount) : 1;
    this.wasQuiescent = false;
    this.rotateBuckets();
    this.inBuckets[this.currentBucketIndex] += count;
    this.processAvalancheEvent(count);
  }

  /**
   * Registra la retransmisión local de un paquete hacia vecinos (descendiente).
   */
  public recordPacketRelayed(packetCount = 1): void {
    const count = typeof packetCount === 'number' && Number.isFinite(packetCount) && packetCount > 0 ? Math.floor(packetCount) : 1;
    this.wasQuiescent = false;
    this.rotateBuckets();
    this.outBuckets[this.currentBucketIndex] += count;
    this.processAvalancheEvent(count);
  }

  /**
   * Gestiona el inicio o acumulación de una avalancha de información.
   */
  private processAvalancheEvent(count: number): void {
    const now = Date.now();
    if (now - this.lastPacketEventTime > SwarmCriticalityEngine.QUIET_THRESHOLD_MS && this.currentAvalancheSize > 0) {
      this.finalizeAvalanche();
    }

    if (this.currentAvalancheSize === 0) {
      this.currentAvalancheStartTime = now;
    }

    this.currentAvalancheSize += count;
    this.lastPacketEventTime = now;
  }

  /**
   * Cierra la avalancha activa si ha transcurrido el tiempo de silencio.
   */
  private checkAvalancheClosure(): void {
    const now = Date.now();
    if (this.currentAvalancheSize > 0 && now - this.lastPacketEventTime > SwarmCriticalityEngine.QUIET_THRESHOLD_MS) {
      this.finalizeAvalanche();
    }
  }

  private finalizeAvalanche(): void {
    if (this.currentAvalancheSize <= 0) return;

    const duration = Math.max(1, Math.abs(this.lastPacketEventTime - this.currentAvalancheStartTime));
    this.avalancheCounter++;

    const rec: AvalancheRecord = {
      id: this.avalancheCounter,
      size: this.currentAvalancheSize,
      durationMs: duration,
      timestamp: this.lastPacketEventTime,
    };

    this.avalancheHistory.push(rec);
    if (this.avalancheHistory.length > SwarmCriticalityEngine.MAX_AVALANCHE_HISTORY) {
      this.avalancheHistory.shift();
    }

    this.currentAvalancheSize = 0;
    this.currentAvalancheStartTime = 0;
  }

  /**
   * Avanza los cubos de tiempo deslizantes en función del reloj real.
   */
  private rotateBuckets(): void {
    const now = Date.now();
    const elapsed = now - this.lastBucketRotationTime;
    if (elapsed < 0) {
      this.lastBucketRotationTime = now;
      return;
    }
    const steps = Math.floor(elapsed / SwarmCriticalityEngine.BUCKET_DURATION_MS);

    if (steps > 0) {
      const stepsToAdvance = Math.min(steps, SwarmCriticalityEngine.BUCKET_COUNT);
      for (let i = 0; i < stepsToAdvance; i++) {
        this.currentBucketIndex = (this.currentBucketIndex + 1) % SwarmCriticalityEngine.BUCKET_COUNT;
        this.inBuckets[this.currentBucketIndex] = 0;
        this.outBuckets[this.currentBucketIndex] = 0;
      }
      this.lastBucketRotationTime = now;
    }
  }

  /**
   * Calcula el Branching Ratio instantáneo (sigma).
   */
  public computeBranchingRatio(): number {
    let totalIn = 0;
    let totalOut = 0;

    for (let i = 0; i < SwarmCriticalityEngine.BUCKET_COUNT; i++) {
      totalIn += this.inBuckets[i];
      totalOut += this.outBuckets[i];
    }

    if (totalIn === 0 && totalOut === 0) {
      return 1.0; // En reposo total, la red se asume balanceada críticamente
    }

    if (totalIn === 0 && totalOut > 0) {
      return 2.0; // Emisión local sin entradas previas
    }

    return totalOut / totalIn;
  }

  /**
   * Determina el estado de fase crítico actual.
   */
  public getCriticalityState(): CriticalityPhaseState {
    const sigma = this.computeBranchingRatio();
    if (sigma < 0.90) return 'SUB_CRITICAL';
    if (sigma > 1.10) return 'SUPER_CRITICAL';
    return 'CRITICAL';
  }

  /**
   * Estima el exponente de ley de potencias alpha para el tamaño de las avalanchas
   * mediante el estimador de máxima verosimilitud (MLE de Clauset et al.):
   * alpha = 1 + N * [sum(ln(S_i / (S_min - 0.5)))]^(-1)
   */
  public estimatePowerLawExponent(): number {
    if (this.avalancheHistory.length < 5) {
      return 1.50; // Valor canónico de campo medio para procesos de ramificación críticos
    }

    const sMin = 1.0;
    let logSum = 0;
    let validCount = 0;

    for (const av of this.avalancheHistory) {
      if (av.size >= sMin) {
        logSum += Math.log(av.size / (sMin - 0.5));
        validCount++;
      }
    }

    if (validCount < 5 || logSum <= 0) return 1.50;

    const alpha = 1.0 + validCount / logSum;
    return Math.max(1.10, Math.min(3.00, Math.round(alpha * 100) / 100));
  }

  /**
   * Bucle de control homeostático (Plasticidad Intrínseca de Turrigiano).
   * Adapta P_relay dinámicamente para devolver a la red al atractor sigma = 1.0.
   */
  public evaluateHomeostaticAdaptation(): void {
    const sigma = this.computeBranchingRatio();
    if (!Number.isFinite(sigma)) return;

    if (sigma > 1.10) {
      // Super-crítico: frenar retransmisiones para apagar la tormenta
      const overshoot = sigma - 1.0;
      this.relayProbability = Math.max(0.10, this.relayProbability - 0.08 * overshoot);

      // Si la explosión es grave, emitir micro-espiga AER táctica
      if (sigma > 1.25) {
        this.emitSupercriticalAlertSpike(sigma);
      }
    } else if (sigma < 0.90) {
      // Sub-crítico: relajar umbrales y estimular retransmisiones para mantener la cobertura
      const deficit = 1.0 - sigma;
      this.relayProbability = Math.min(1.00, this.relayProbability + 0.05 * deficit);
    } else {
      // Crítico óptimo: retorno suave hacia 1.0
      if (this.relayProbability < 1.0) {
        this.relayProbability = Math.min(1.00, this.relayProbability + 0.02);
      }
    }
  }

  /**
   * Emite una micro-espiga AER compacta (14B) cuando el enjambre cruza el umbral super-crítico.
   */
  private emitSupercriticalAlertSpike(sigma: number): void {
    const now = Date.now();
    if (now - this.lastAerAlertTime < SwarmCriticalityEngine.AER_COOLDOWN_MS) return;
    this.lastAerAlertTime = now;

    try {
      meshRouter.broadcastAerSpike(
        AerDomainCode.PHEROMONE_ALARM,
        0xEE, // Código de alarma de tormenta super-crítica
        Math.min(255, Math.round(sigma * 100))
      ).catch(() => {});
    } catch {}
  }

  /**
   * Devuelve la probabilidad homeostática de retransmisión [0.10 .. 1.00].
   */
  public getRelayProbability(): number {
    return Math.round(this.relayProbability * 100) / 100;
  }

  /**
   * Calcula el umbral dinámico de supresión K-counter para BroadcastStormGuardEngine.
   */
  public getAdaptiveKThreshold(peerCount: number): number {
    const count = typeof peerCount === 'number' && Number.isFinite(peerCount) ? peerCount : 0;
    const base = count > 15 ? 2 : count > 6 ? 3 : 5;
    const sigma = this.computeBranchingRatio();

    if (sigma > 1.20) {
      return Math.max(1, base - 1); // Más estricto ante tormenta
    } else if (sigma < 0.80) {
      return base + 1; // Más permisivo ante sub-criticalidad
    }
    return base;
  }

  /**
   * Decide probabilísticamente si un paquete evaluado debe ser retransmitido.
   */
  public shouldRelayProbabilistic(): boolean {
    if (this.relayProbability >= 0.99) return true;
    return Math.random() <= this.relayProbability;
  }

  /**
   * Genera la instantánea de telemetría completa de criticalidad.
   */
  public getTelemetry(): SwarmCriticalityTelemetry {
    let totalIn = 0;
    let totalOut = 0;
    for (let i = 0; i < SwarmCriticalityEngine.BUCKET_COUNT; i++) {
      totalIn += this.inBuckets[i];
      totalOut += this.outBuckets[i];
    }

    const lastAv = this.avalancheHistory[this.avalancheHistory.length - 1];

    return {
      timestamp: Date.now(),
      branchingRatio: Math.round(this.computeBranchingRatio() * 100) / 100,
      criticalityState: this.getCriticalityState(),
      estimatedAlpha: this.estimatePowerLawExponent(),
      relayProbability: this.getRelayProbability(),
      adaptiveKCounterThreshold: this.getAdaptiveKThreshold(10),
      totalAvalanchesCount: this.avalancheCounter,
      lastAvalancheSize: lastAv ? lastAv.size : 0,
      lastAvalancheDurationMs: lastAv ? lastAv.durationMs : 0,
      recentAvalanches: [...this.avalancheHistory].slice(-10),
      packetsInWindow: totalIn,
      packetsOutWindow: totalOut,
      isEngineActive: this.isRunning,
    };
  }

  public subscribe(callback: (telem: SwarmCriticalityTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(force = false): void {
    let totalIn = 0;
    let totalOut = 0;
    for (let i = 0; i < SwarmCriticalityEngine.BUCKET_COUNT; i++) {
      totalIn += this.inBuckets[i];
      totalOut += this.outBuckets[i];
    }

    const isCurrentlyQuiescent = (totalIn === 0 && totalOut === 0 && this.currentAvalancheSize === 0 && this.relayProbability >= 0.99);

    if (!force && isCurrentlyQuiescent && this.wasQuiescent) {
      // Reposo absoluto: suspender re-renders redundantes en UI
      return;
    }

    this.wasQuiescent = isCurrentlyQuiescent;
    const telem = this.getTelemetry();
    for (const listener of this.listeners) {
      try {
        listener(telem);
      } catch {}
    }
  }

  public reset(): void {
    this.resetForTesting();
    this.notifyListeners();
  }

  public resetForTesting(): void {
    this.inBuckets.fill(0);
    this.outBuckets.fill(0);
    this.currentBucketIndex = 0;
    this.lastBucketRotationTime = Date.now();
    this.relayProbability = 1.00;
    this.currentAvalancheSize = 0;
    this.currentAvalancheStartTime = 0;
    this.lastPacketEventTime = 0;
    this.avalancheCounter = 0;
    this.avalancheHistory = [];
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    SwarmCriticalityEngine.instance = null;
  }
}

export const swarmCriticality = SwarmCriticalityEngine.getInstance();

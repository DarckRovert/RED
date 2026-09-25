/**
 * ConnectomeEcosystemOrchestrator.ts — RED Sovereign Mesh OS
 *
 * Orquestador Central Bio-Cibernético del Conectoma de Drosophila melanogaster
 * (MaleCNS v1.0, Princeton Murthy Lab / FlyWire Connectome).
 *
 * Propósito Arquitectónico:
 * Unifica los siete subsistemas neurofisiológicos en un único organismo vivo,
 * cerrando los arcos reflejos y la retroalimentación neuro-simbólica:
 * 1. Brújula Inercial E-PG (RingAttractorEngine)
 * 2. Navegación Vectorial 3D Fan-Shaped Body (FanShapedBodyEngine)
 * 3. Enrutamiento Sináptico Hebbiano & AoA (SynapticMeshRouterEngine)
 * 4. Memoria DTN Dopaminérgica & Feromonas (DtnMushroomBodyEngine)
 * 5. Sistema de Escape Monosináptico EW (GiantFiberReflexEngine)
 * 6. Sensor Acústico/Mecánico Antenal (JohnstonOrganEngine)
 * 7. Gobernador Metabólico Neuroendocrino IPC/NPF (MetabolicNeuromorphicGovernor)
 */

import { ringAttractor, RingAttractorTelemetry } from './RingAttractorEngine';
import { fanShapedBody, FanShapedBodyTelemetry } from './FanShapedBodyEngine';
import { synapticMeshRouter, SynapticMeshTelemetry } from './SynapticMeshRouterEngine';
import { dtnMushroomBody, MushroomBodyTelemetry } from './DtnMushroomBodyEngine';
import { giantFiberReflex, GiantFiberTelemetry } from './GiantFiberReflexEngine';
import { johnstonOrgan, JohnstonOrganTelemetry } from './JohnstonOrganEngine';
import { metabolicGovernor, MetabolicGovernorTelemetry } from './MetabolicNeuromorphicGovernor';
import { opticLobe, OpticLobeTelemetry } from './OpticLobeEngine';
import { tacticalMotorActuator, TacticalMotorActuatorTelemetry } from './TacticalMotorActuatorEngine';
import { centralPatternGenerator, CpgLocomotionTelemetry } from './CentralPatternGeneratorEngine';
import { swarmCriticality, SwarmCriticalityTelemetry } from './SwarmCriticalityEngine';
import { bioCompassDualFusion, BioCompassDualTelemetry } from './BioCompassDualFusionEngine';
import { sensoriomotorAutonomicBridge, AutonomicBridgeTelemetry } from './SensoriomotorAutonomicBridge';

export interface EcosystemConnectomeSnapshot {
  timestamp: number;
  organismState: 'OPTIMAL' | 'CONSERVING' | 'EMCON_SILENCED' | 'TORPOR';
  healthScore: number; // 0 - 100
  // Telemetrías de los subsistemas bio-cibernéticos
  compass: RingAttractorTelemetry;
  fanShapedBody: FanShapedBodyTelemetry;
  synapticRouter: SynapticMeshTelemetry;
  mushroomBody: MushroomBodyTelemetry;
  giantFiber: GiantFiberTelemetry;
  johnstonOrgan: JohnstonOrganTelemetry;
  metabolicGovernor: MetabolicGovernorTelemetry;
  opticLobe: OpticLobeTelemetry;
  motorActuator: TacticalMotorActuatorTelemetry;
  cpg: CpgLocomotionTelemetry;
  criticality: SwarmCriticalityTelemetry;
  bioCompassDual?: BioCompassDualTelemetry;
  /** Telemetría del Puente Sensoriomotor Autonómico (sensores físicos ↔ neuro-núcleos) */
  autonomicBridge: AutonomicBridgeTelemetry;
  // Resumen sintético táctico
  tacticalSummary: string;
}

export class ConnectomeEcosystemOrchestrator {
  private static instance: ConnectomeEcosystemOrchestrator | null = null;

  private isRunning = false;
  private unsubs: Array<() => void> = [];
  private listeners: Set<(snapshot: EcosystemConnectomeSnapshot) => void> = new Set();
  private lastNotifyTime = 0;
  private notifyThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  public static readonly UI_THROTTLE_MS = 100;
  public static readonly SNAPSHOT_CACHE_TTL_MS = 50;
  private cachedSnapshot: EcosystemConnectomeSnapshot | null = null;
  private lastSnapshotTime = 0;

  private constructor() {}

  public static getInstance(): ConnectomeEcosystemOrchestrator {
    if (!ConnectomeEcosystemOrchestrator.instance) {
      ConnectomeEcosystemOrchestrator.instance = new ConnectomeEcosystemOrchestrator();
    }
    return ConnectomeEcosystemOrchestrator.instance;
  }

  /**
   * Inicia el orquestador y conecta los circuitos inter-neuronales.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Iniciar motores subyacentes
    ringAttractor.start();
    fanShapedBody.start();
    johnstonOrgan.start();
    metabolicGovernor.start();
    opticLobe.start();
    tacticalMotorActuator.start();
    centralPatternGenerator.start();
    swarmCriticality.start();

    // 2. Acoplar Johnston's Organ con Giant Fiber Reflex
    // Si Johnston Organ detecta choque extremo -> alerta, refuerzo aversivo PPL1 y despacho al orquestador
    const unSubJo = johnstonOrgan.subscribe((joTelem: JohnstonOrganTelemetry) => {
      if (joTelem.lastShockEvent && joTelem.lastShockEvent.triggeredReflex) {
        this.cachedSnapshot = null;
        this.lastSnapshotTime = 0;
        dtnMushroomBody.reinforceAversion(
          'ENVIRONMENT_SHOCK',
          0.85,
          `Choque acústico/mecánico súbito (${joTelem.lastShockEvent.sourceType})`
        );
        dtnMushroomBody.applyDopaminergicNeuromodulation('PPL1', 0.70, 'lora_ch_0');
      }
      this.notifyListeners();
    });
    this.unsubs.push(unSubJo);

    // 3. Acoplar Gobernador Metabólico con Frecuencia de Notificación
    const unSubMetabolic = metabolicGovernor.subscribe((metTelem: MetabolicGovernorTelemetry) => {
      // Si conmuta de régimen (e.g. TORPOR o CONSERVATIVE), purgar caché para retorno inmediato
      this.cachedSnapshot = null;
      this.lastSnapshotTime = 0;
      if (metTelem.regime === 'TORPOR') {
        // En torpor desactivar ráfagas motoras para preservación extrema de hardware
        tacticalMotorActuator.stop();
      } else if (this.isRunning) {
        tacticalMotorActuator.start();
      }
      this.notifyListeners();
    });
    this.unsubs.push(unSubMetabolic);

    // 4. Suscripciones para despacho hacia suscriptores del orquestador
    const unSubCompass = ringAttractor.subscribe(() => this.notifyListeners());
    const unSubFb = fanShapedBody.subscribe(() => this.notifyListeners());
    const unSubMb = dtnMushroomBody.subscribe(() => this.notifyListeners());
    const unSubSyn = synapticMeshRouter.subscribe(() => this.notifyListeners());
    const unSubGfs = giantFiberReflex.subscribe((gfsTelem: GiantFiberTelemetry) => {
      if (gfsTelem.isReflexActive) {
        tacticalMotorActuator.triggerEmergencyBurst();
      }
      this.notifyListeners();
    });
    const unSubOptic = opticLobe.subscribe((opticTelem: OpticLobeTelemetry) => {
      if (opticTelem.loomingThreat.isThreatDetected) {
        tacticalMotorActuator.triggerEmergencyBurst();
      }
      this.notifyListeners();
    });
    const unSubMotor = tacticalMotorActuator.subscribe(() => this.notifyListeners());
    const unSubCrit = swarmCriticality.subscribe(() => this.notifyListeners());
    bioCompassDualFusion.start();
    const unSubDual = bioCompassDualFusion.subscribe(() => this.notifyListeners());

    const unSubCpg = centralPatternGenerator.subscribe(() => this.notifyListeners());

    // 5. Activar Puente Sensoriomotor Autonómico (cierra el bucle hardware ↔ neuro-núcleos)
    const bridgeOk = sensoriomotorAutonomicBridge.start();
    const unSubBridge = sensoriomotorAutonomicBridge.subscribe(() => this.notifyListeners());
    if (!bridgeOk) {
      console.warn('[ConnectomeOrchestrator] ⚠️ SensoriomotorAutonomicBridge arrancó en modo degradado (hardware no disponible)');
    }

    this.unsubs.push(unSubCompass, unSubFb, unSubMb, unSubSyn, unSubGfs, unSubOptic, unSubMotor, unSubCrit, unSubDual, unSubCpg, unSubBridge);
    console.log('[ConnectomeOrchestrator] 🦗 Drosophila MaleCNS living organism initialized and active in background');
    console.log('[ConnectomeOrchestrator] 🔗 Sensoriomotor Autonomic Bridge ONLINE — bucle cibernético físico cerrado.');
    this.notifyListeners();
  }

  public isOrganismRunning(): boolean {
    return this.isRunning;
  }

  public triggerEmergencyBurst(reason: string = 'MANUAL_OVERRIDE'): void {
    const VALID_SOURCES = ['EW_JAMMING', 'IMSI_CATCHER', 'ROGUE_CARRIER_DOWNGRADE', 'GONIOMETRIC_PING', 'VISUAL_LOOMING_THREAT', 'MANUAL_TACTICAL_SCRAM'] as const;
    const safeReason = VALID_SOURCES.includes(reason as any) ? reason as (typeof VALID_SOURCES)[number] : 'MANUAL_TACTICAL_SCRAM';
    this.cachedSnapshot = null;
    this.lastSnapshotTime = 0;
    giantFiberReflex.triggerEmergencyJump(safeReason);
    tacticalMotorActuator.triggerEmergencyBurst();
    this.notifyListeners();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.notifyThrottleTimer) {
      clearTimeout(this.notifyThrottleTimer);
      this.notifyThrottleTimer = null;
    }
    this.unsubs.forEach(u => {
      try { u(); } catch {}
    });
    this.unsubs = [];
    ringAttractor.stop();
    fanShapedBody.stop();
    johnstonOrgan.stop();
    metabolicGovernor.stop();
    opticLobe.stop();
    tacticalMotorActuator.stop();
    centralPatternGenerator.stop();
    swarmCriticality.stop();
    bioCompassDualFusion.stop();
    sensoriomotorAutonomicBridge.stop();
    this.cachedSnapshot = null;
    this.lastSnapshotTime = 0;
    if (this.listeners.size > 0) {
      this.dispatchSnapshot();
    }
  }

  /**
   * Genera la instantánea integral del organismo bio-cibernético completo.
   * Cuenta con un caché determinista de 50ms para soportar consultas de alta frecuencia (e.g. 60 FPS de física)
   * y un getter memoizado para 'tacticalSummary' que evita asignaciones de strings innecesarias en V8.
   */
  public getOrganismSnapshot(forceFresh = false): EcosystemConnectomeSnapshot {
    const now = Date.now();
    if (!forceFresh && this.cachedSnapshot && (now - this.lastSnapshotTime < ConnectomeEcosystemOrchestrator.SNAPSHOT_CACHE_TTL_MS)) {
      return this.cachedSnapshot;
    }

    const compass = ringAttractor.getTelemetry();
    const fb = fanShapedBody.getTelemetry();
    const synapticRouter = synapticMeshRouter.getTelemetry();
    const mushroomBody = dtnMushroomBody.getTelemetry();
    const giantFiber = giantFiberReflex.getTelemetry();
    const jo = johnstonOrgan.getTelemetry();
    const metabolic = metabolicGovernor.getTelemetry();
    const optic = opticLobe.getTelemetry();
    const motor = tacticalMotorActuator.getTelemetry();
    const cpg = centralPatternGenerator.getTelemetry();
    const criticality = swarmCriticality.getTelemetry();
    const bioCompassDual = bioCompassDualFusion.getTelemetry();
    const autonomicBridge = sensoriomotorAutonomicBridge.getTelemetry();

    // Determinar estado de salud y régimen global del organismo
    let organismState: EcosystemConnectomeSnapshot['organismState'] = 'OPTIMAL';
    if (giantFiber.emconLockActive) {
      organismState = 'EMCON_SILENCED';
    } else if (metabolic.regime === 'TORPOR') {
      organismState = 'TORPOR';
    } else if (metabolic.regime === 'CONSERVATIVE') {
      organismState = 'CONSERVING';
    }

    let healthScore = 100;
    if (metabolic.batteryPct < 20) healthScore -= 40;
    else if (metabolic.batteryPct < 50) healthScore -= 15;
    if (giantFiber.emconLockActive) healthScore -= 20;
    if (mushroomBody.currentSaturationRatio > 0.8) healthScore -= 15;
    if (!compass.isSensoryAnchored) healthScore -= 10;
    if (optic.loomingThreat.isThreatDetected) healthScore -= 25;
    healthScore = Math.max(10, healthScore);

    let memoSummary: string | null = null;
    const snapshot: EcosystemConnectomeSnapshot = {
      timestamp: now,
      organismState,
      healthScore,
      compass,
      fanShapedBody: fb,
      synapticRouter,
      mushroomBody,
      giantFiber,
      johnstonOrgan: jo,
      metabolicGovernor: metabolic,
      opticLobe: optic,
      motorActuator: motor,
      cpg,
      criticality,
      bioCompassDual,
      autonomicBridge,
      get tacticalSummary(): string {
        if (memoSummary === null) {
          memoSummary = `Conectoma Drosophila MaleCNS: Estado ${organismState} (Salud ${healthScore}%). ` +
            `Brújula E-PG a ${compass.headingDeg}° (${compass.cardinal}). ` +
            `Home Vector FB a ${fb.homeVector.distanceMeters}m rumbo ${fb.homeVector.bearingDeg}° (${fb.homeVector.cardinal}). ` +
            `Red: ${synapticRouter.totalSynapses} sinapsis, ${mushroomBody.totalEnqueuedRecords} engramas MB (${mushroomBody.behavioralDrive}). ` +
            `Visión T4/T5: Flujo ${optic.translationalFlow.magnitude} m/s, Looming: ${optic.loomingThreat.isThreatDetected ? 'AMENAZA' : 'DESPEJADO'}. ` +
            `Actuador Háptico DNa: Modo ${motor.currentHapticMode}. ` +
            `CPG Hexápodo: Modo ${cpg.gaitMode} (${cpg.meanFrequencyHz} Hz, Coherencia R=${cpg.tripodCoherenceIndex}). ` +
            `Criticalidad SOC: Estado ${criticality.criticalityState} (σ=${criticality.branchingRatio.toFixed(2)}, α=${criticality.estimatedAlpha.toFixed(2)}, Prelay=${(criticality.relayProbability * 100).toFixed(0)}%). ` +
            `Compás Dual: Coherencia ${(bioCompassDual.phaseCoherence * 100).toFixed(0)}% (${bioCompassDual.phaseCoherenceState}), Deriva ${bioCompassDual.estimatedDriftMeters}m, Resets ${bioCompassDual.hippocampalResetsCount}. ` +
            `Mecanorrecepción JO: ${jo.acousticEnergyLevel > 0.5 ? 'ALERTA' : 'NOMINAL'}. ` +
            `Metabolismo: ${metabolic.regime} (Batería ${metabolic.batteryPct}%, Autonomía est. ${metabolic.estimatedStandbyHours}h). ` +
            `Bridge SAB: ${autonomicBridge.isRunning ? 'ONLINE' : 'OFFLINE'} — Espigas emitidas: ${autonomicBridge.totalSpikesEmitted}, Rx remotas: ${autonomicBridge.totalRemoteSpikesReceived}, CBRN: ${autonomicBridge.lastCbrnLevel}.`;
        }
        return memoSummary;
      },
    };

    this.cachedSnapshot = snapshot;
    this.lastSnapshotTime = now;
    return snapshot;
  }

  public subscribe(callback: (snapshot: EcosystemConnectomeSnapshot) => void): () => void {
    this.listeners.add(callback);
    callback(this.getOrganismSnapshot(true));
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
    };
  }

  private notifyListeners(): void {
    if (!this.isRunning || this.listeners.size === 0) return;
    const now = Date.now();
    const elapsed = now - this.lastNotifyTime;

    if (elapsed >= ConnectomeEcosystemOrchestrator.UI_THROTTLE_MS) {
      if (this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
      this.lastNotifyTime = now;
      this.dispatchSnapshot();
    } else if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        if (!this.isRunning || this.listeners.size === 0) return;
        this.lastNotifyTime = Date.now();
        this.dispatchSnapshot();
      }, ConnectomeEcosystemOrchestrator.UI_THROTTLE_MS - elapsed);
    }
  }

  private dispatchSnapshot(): void {
    if (this.listeners.size === 0) return;
    const snap = this.getOrganismSnapshot(true);
    for (const cb of this.listeners) {
      try {
        cb(snap);
      } catch (err) {
        console.error('[ConnectomeOrchestrator] Error en listener callback:', err);
      }
    }
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    ConnectomeEcosystemOrchestrator.instance = null;
  }
}

export const connectomeOrchestrator = ConnectomeEcosystemOrchestrator.getInstance();

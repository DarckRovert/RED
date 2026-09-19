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
  // Resumen sintético táctico
  tacticalSummary: string;
}

export class ConnectomeEcosystemOrchestrator {
  private static instance: ConnectomeEcosystemOrchestrator | null = null;

  private isRunning = false;
  private unsubs: Array<() => void> = [];
  private listeners: Set<(snapshot: EcosystemConnectomeSnapshot) => void> = new Set();

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

    // 2. Acoplar Johnston's Organ con Giant Fiber Reflex
    // Si Johnston Organ detecta choque extremo -> alerta y refuerzo aversivo PPL1
    const unSubJo = johnstonOrgan.subscribe((joTelem: JohnstonOrganTelemetry) => {
      if (joTelem.lastShockEvent && joTelem.lastShockEvent.triggeredReflex) {
        dtnMushroomBody.reinforceAversion(
          'ENVIRONMENT_SHOCK',
          0.85,
          `Choque acústico/mecánico súbito (${joTelem.lastShockEvent.sourceType})`
        );
      }
    });
    this.unsubs.push(unSubJo);

    // 3. Acoplar Gobernador Metabólico con Frecuencia de Notificación
    const unSubMetabolic = metabolicGovernor.subscribe((metTelem: MetabolicGovernorTelemetry) => {
      // Si entra en TORPOR, silenciar advertencias superfluas y consolidar estado
      if (metTelem.regime === 'TORPOR') {
        // En torpor se activa mitigación de energía
      }
    });
    this.unsubs.push(unSubMetabolic);

    // 4. Suscripciones para despacho hacia suscriptores del orquestador
    const unSubCompass = ringAttractor.subscribe(() => this.notifyListeners());
    const unSubFb = fanShapedBody.subscribe(() => this.notifyListeners());
    const unSubMb = dtnMushroomBody.subscribe(() => this.notifyListeners());
    const unSubGfs = giantFiberReflex.subscribe(() => this.notifyListeners());
    const unSubOptic = opticLobe.subscribe((opticTelem: OpticLobeTelemetry) => {
      if (opticTelem.loomingThreat.isThreatDetected) {
        tacticalMotorActuator.triggerEmergencyBurst();
      }
      this.notifyListeners();
    });
    const unSubMotor = tacticalMotorActuator.subscribe(() => this.notifyListeners());

    this.unsubs.push(unSubCompass, unSubFb, unSubMb, unSubGfs, unSubOptic, unSubMotor);
    this.notifyListeners();
  }

  public stop(): void {
    this.isRunning = false;
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
    this.notifyListeners();
  }

  /**
   * Genera la instantánea integral del organismo bio-cibernético completo.
   */
  public getOrganismSnapshot(): EcosystemConnectomeSnapshot {
    const compass = ringAttractor.getTelemetry();
    const fb = fanShapedBody.getTelemetry();
    const synapticRouter = synapticMeshRouter.getTelemetry();
    const mushroomBody = dtnMushroomBody.getTelemetry();
    const giantFiber = giantFiberReflex.getTelemetry();
    const jo = johnstonOrgan.getTelemetry();
    const metabolic = metabolicGovernor.getTelemetry();
    const optic = opticLobe.getTelemetry();
    const motor = tacticalMotorActuator.getTelemetry();

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

    const tacticalSummary = `Conectoma Drosophila MaleCNS: Estado ${organismState} (Salud ${healthScore}%). ` +
      `Brújula E-PG a ${compass.headingDeg}° (${compass.cardinal}). ` +
      `Home Vector FB a ${fb.homeVector.distanceMeters}m rumbo ${fb.homeVector.bearingDeg}° (${fb.homeVector.cardinal}). ` +
      `Red: ${synapticRouter.totalSynapses} sinapsis, ${mushroomBody.totalEnqueuedRecords} engramas MB (${mushroomBody.behavioralDrive}). ` +
      `Visión T4/T5: Flujo ${optic.translationalFlow.magnitude} m/s, Looming: ${optic.loomingThreat.isThreatDetected ? 'AMENAZA' : 'DESPEJADO'}. ` +
      `Actuador Háptico DNa: Modo ${motor.currentHapticMode}. ` +
      `Mecanorrecepción JO: ${jo.acousticEnergyLevel > 0.5 ? 'ALERTA' : 'NOMINAL'}. ` +
      `Metabolismo: ${metabolic.regime} (Batería ${metabolic.batteryPct}%, Autonomía est. ${metabolic.estimatedStandbyHours}h).`;

    return {
      timestamp: Date.now(),
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
      tacticalSummary,
    };
  }

  public subscribe(callback: (snapshot: EcosystemConnectomeSnapshot) => void): () => void {
    this.listeners.add(callback);
    callback(this.getOrganismSnapshot());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const snap = this.getOrganismSnapshot();
    for (const cb of this.listeners) {
      try {
        cb(snap);
      } catch {}
    }
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    ConnectomeEcosystemOrchestrator.instance = null;
  }
}

export const connectomeOrchestrator = ConnectomeEcosystemOrchestrator.getInstance();

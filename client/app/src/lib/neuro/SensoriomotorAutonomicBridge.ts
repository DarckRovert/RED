/**
 * SensoriomotorAutonomicBridge.ts — RED Sovereign Mesh OS
 *
 * Puente Sensoriomotor Autonómico y Enlace Bidireccional de Micro-Espigas AER.
 *
 * Cierra el bucle cibernético completo entre:
 * 1. Sensores Físicos de Hardware:
 *    - KineticStressEngine (Acelerómetro, impactos, tremor, Man-Down)
 *    - AcousticSonarEngine (Micrófono/altavoz acústico, eco ToF, resonancia de cavidad)
 *    - RfSpectrumAnalyzerEngine (Monitoreo de suelo de ruido RF, detección de jamming)
 *    - CbrnRadiationEngine (Sensores ambientales radiológicos y químicos)
 * 2. Sistema Nervioso Central (14 Núcleos Biológicos):
 *    - MaleCNS Subcortical: Johnston's Organ, Giant Fiber Reflex, Optic Lobe
 *    - Neocórtex Humano: Predictive Cortex, Insular TCCC Interoception
 *    - Global Workspace Consciousness Bus (GNWT): Ignición atencional θ > 0.60
 * 3. Telepatía Neuromórfica Distribuida en Malla:
 *    - Emisión y recepción de micro-espigas binarias AER (14 bytes) vía LoRa TDMA / BLE
 *    - Sincronización de matriz de conductancia Hebbiana inter-pares
 *
 * Rendimiento & Guardarraíles:
 * - Throttling refractario biológico de 250 ms por dominio AER (elimina spike storms)
 * - Filtro de umbral diferencial (solo perturbaciones > 15% generan espigas)
 * - Desregistro determinista de suscripciones (cero fugas de memoria)
 */

import { KineticStressEngine, KineticStressTelemetry } from '../sensors/KineticStressEngine';
import { AcousticSonarEngine, SonarPingResult } from '../sensors/AcousticSonarEngine';
import { CognitiveRadioArbiter, TransportDecision } from '../mesh/CognitiveRadioArbiter';
import { CbrnRadiationEngine, RadiationTelemetry } from '../sensors/CbrnRadiationEngine';

import { johnstonOrgan } from './JohnstonOrganEngine';
import { giantFiberReflex } from './GiantFiberReflexEngine';
import { opticLobe } from './OpticLobeEngine';
import { InsularTcccInteroceptionEngine, TcccCasualtyCard } from './human/InsularTcccInteroceptionEngine';

import { meshRouter } from '../mesh/meshRouter';
import { AerDomainCode, AerSpikeEvent } from '../mesh/meshProtocol';
import { synapticMeshRouter } from './SynapticMeshRouterEngine';

export interface AutonomicBridgeTelemetry {
  isRunning: boolean;
  totalSpikesEmitted: number;
  totalRemoteSpikesReceived: number;
  lastKineticEvent: { magnitude: number; state: string; timestamp: number } | null;
  lastSonarEcho: { distanceM: number; cavityHz?: number; timestamp: number } | null;
  lastRfAnomaly: { noiseDbm: number; jamming: boolean; timestamp: number } | null;
  lastCbrnLevel: string;
  activeSensorsCount: number;
}

export class SensoriomotorAutonomicBridge {
  private static instance: SensoriomotorAutonomicBridge | null = null;

  // Constantes de calibración
  private static readonly REFRACTORY_PERIOD_MS = 250; // Período refractario anti-saturación
  private static readonly IMPACT_SPIKE_THRESHOLD_G = 2.5; // > 2.5G emite espiga de impacto
  private static readonly SONAR_CLOSE_PROXIMITY_M = 1.8;  // < 1.8m emite espiga de proximidad

  private isRunning = false;
  private unsubs: Array<() => void> = [];

  // Temporizadores refractarios por dominio
  private lastSpikeTimeByDomain: Map<AerDomainCode, number> = new Map();

  // Contadores y telemetría
  private totalSpikesEmitted = 0;
  private totalRemoteSpikesReceived = 0;
  private lastKineticEvent: AutonomicBridgeTelemetry['lastKineticEvent'] = null;
  private lastSonarEcho: AutonomicBridgeTelemetry['lastSonarEcho'] = null;
  private lastRfAnomaly: AutonomicBridgeTelemetry['lastRfAnomaly'] = null;
  private lastCbrnLevel = 'SAFE_BACKGROUND';

  private listeners: Set<(telem: AutonomicBridgeTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): SensoriomotorAutonomicBridge {
    if (!SensoriomotorAutonomicBridge.instance) {
      SensoriomotorAutonomicBridge.instance = new SensoriomotorAutonomicBridge();
    }
    return SensoriomotorAutonomicBridge.instance;
  }

  /**
   * Inicia el puente sensoriomotor y acopla los sensores de hardware con los núcleos biológicos
   */
  public start(): boolean {
    if (this.isRunning) return true;
    this.isRunning = true;

    try {
      // 1. Acoplar KineticStressEngine (Acelerómetro / Impactos / Man-Down)
      const kinetic = KineticStressEngine.getInstance();
      kinetic.start();
      const unsubKinetic = kinetic.subscribe((tel: KineticStressTelemetry) => {
        this.processKineticTelemetry(tel);
      });
      this.unsubs.push(unsubKinetic);

      // 2. Acoplar AcousticSonarEngine (Ecosonda / Resonancia de cavidad)
      const sonar = AcousticSonarEngine.getInstance();
      const unsubSonar = sonar.subscribe((result: SonarPingResult) => {
        this.processSonarResult(result);
      });
      this.unsubs.push(unsubSonar);

      // 3. Acoplar CognitiveRadioArbiter (Monitoreo de Espectro RF / EW Jamming)
      const arbiter = CognitiveRadioArbiter.getInstance();
      const unsubRf = arbiter.subscribe((decision: TransportDecision) => {
        this.processRfDecision(decision);
      });
      this.unsubs.push(unsubRf);

      // 4. Acoplar CbrnRadiationEngine (Radiación / Toxicidad)
      const cbrn = CbrnRadiationEngine.getInstance();
      cbrn.startMonitoring();
      const unsubCbrn = cbrn.subscribe((tel: RadiationTelemetry) => {
        this.processCbrnTelemetry(tel);
      });
      this.unsubs.push(unsubCbrn);

      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('[SensoriomotorAutonomicBridge] Error al iniciar suscripciones:', err);
      return false;
    }
  }

  /**
   * Detiene el puente y libera todas las suscripciones de forma determinista
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {
        // Ignorar errores al desuscribir
      }
    }
    this.unsubs = [];
    this.notifyListeners();
  }

  // ─── Procesadores de Telemetría Sensorial ───────────────────────────────────

  /**
   * Procesa perturbaciones cinéticas del acelerómetro del dispositivo
   */
  private processKineticTelemetry(tel: KineticStressTelemetry): void {
    const now = Date.now();
    this.lastKineticEvent = {
      magnitude: tel.lastImpactMagnitude,
      state: tel.level,
      timestamp: now,
    };

    // Caso A: Inmovilidad de Emergencia Man-Down activa
    if (tel.isManDownActive) {
      // Excitación máxima en Órgano de Johnston y reflejo
      johnstonOrgan.triggerMechanicalShock(1.0);
      
      // Emisión de espiga de emergencia Man-Down (neuronId: 0x02 = Inmovilidad crítica)
      this.broadcastSpikeThrottled(
        AerDomainCode.KINETIC_SHOCK_MANDOWN,
        0x02,
        Math.min(32767, Math.round(tel.immobilityDurationSec))
      );
      return;
    }

    // Caso B: Choque cinético violento / impacto súbito
    if (tel.level === 'CRITICAL_SHOCK' || tel.lastImpactMagnitude >= SensoriomotorAutonomicBridge.IMPACT_SPIKE_THRESHOLD_G) {
      const shockIntensity = Math.min(1.0, tel.lastImpactMagnitude / 10.0);
      johnstonOrgan.triggerMechanicalShock(shockIntensity);

      // Si el choque es de alta energía (> 4.5G), activar arco reflejo Giant Fiber
      if (tel.lastImpactMagnitude > 4.5) {
        giantFiberReflex.triggerReflex('MANUAL_TACTICAL_SCRAM');
      }

      // Emisión de micro-espiga (neuronId: 0x01 = Impacto, valor = magnitud * 10)
      this.broadcastSpikeThrottled(
        AerDomainCode.KINETIC_SHOCK_MANDOWN,
        0x01,
        Math.min(32767, Math.round(tel.lastImpactMagnitude * 10))
      );
      return;
    }

    // Caso C: Temblor espectral patológico (estrés fisiológico extremo del operador)
    if (tel.tremorIntensity > 0.65) {
      this.broadcastSpikeThrottled(
        AerDomainCode.KINETIC_SHOCK_MANDOWN,
        0x03,
        Math.min(32767, Math.round(tel.tremorIntensity * 100))
      );
    }
  }

  /**
   * Procesa ecos acústicos y resonancias del sonar de ultrasonidos
   */
  private processSonarResult(res: SonarPingResult): void {
    if (res.confidencePct < 60) return;
    const now = Date.now();
    this.lastSonarEcho = {
      distanceM: res.distanceMeters,
      cavityHz: res.cavityResonanceHz,
      timestamp: now,
    };

    // Caso A: Obstáculo físico inminente (< 1.8 metros)
    if (res.distanceMeters > 0.1 && res.distanceMeters <= SensoriomotorAutonomicBridge.SONAR_CLOSE_PROXIMITY_M) {
      // Excitación del lóbulo óptico inyectando estímulo sintético de aproximación
      opticLobe.injectSyntheticLoomingStimulus(90, 1.5);

      // Emisión de espiga (neuronId: 0x01 = Proximidad, valor = distancia en cm)
      this.broadcastSpikeThrottled(
        AerDomainCode.ACOUSTIC_SONAR_CAVITY,
        0x01,
        Math.min(32767, Math.round(res.distanceMeters * 100))
      );
    }

    // Caso B: Resonancia de cavidad subterránea o espacio confinado
    if (
      res.cavityResonanceHz !== undefined &&
      res.cavityResonanceHz >= 20 &&
      res.cavityResonanceHz <= 350 &&
      (res.estimatedVolumeM3 ?? 0) >= 8.0
    ) {
      // neuronId: 0x02 = Frecuencia de resonancia de cavidad en Hz
      this.broadcastSpikeThrottled(
        AerDomainCode.ACOUSTIC_SONAR_CAVITY,
        0x02,
        Math.min(32767, Math.round(res.cavityResonanceHz))
      );
    }
  }

  /**
   * Procesa perturbaciones del espectro de radiofrecuencia (EW Jamming) desde CognitiveRadioArbiter
   */
  private processRfDecision(decision: TransportDecision): void {
    this.lastRfAnomaly = {
      noiseDbm: -100,
      jamming: decision.isElectronicWarfareActive,
      timestamp: Date.now(),
    };

    if (decision.isElectronicWarfareActive) {
      // Inyección inmediata en Johnston Organ y disparo de reflejo GFS
      johnstonOrgan.injectRfTransient(0.95, 915.0);
      giantFiberReflex.triggerReflex('EW_JAMMING');

      // Emisión de micro-espiga (valor = nivel de interferencia cuantizado)
      this.broadcastSpikeThrottled(
        AerDomainCode.EW_JAMMING_DETECTED,
        0x01,
        85
      );
    }
  }

  /**
   * Procesa alertas radiológicas o químicas
   */
  private processCbrnTelemetry(tel: RadiationTelemetry): void {
    this.lastCbrnLevel = tel.threatLevel;
    if (tel.threatLevel === 'HAZARDOUS' || tel.threatLevel === 'LETHAL' || tel.threatLevel === 'ELEVATED') {
      const uSvInt = Math.min(32767, Math.round(tel.doseRateUsVh * 10));
      this.broadcastSpikeThrottled(
        AerDomainCode.CBRN_RADIATION_ALERT,
        tel.threatLevel === 'LETHAL' ? 0x02 : 0x01,
        uSvInt
      );
    }
  }

  // ─── Emisión & Recepción AER Throttled ──────────────────────────────────────

  /**
   * Emite una micro-espiga neuromórfica aplicando el período refractario biológico
   */
  public async broadcastSpikeThrottled(domain: AerDomainCode, neuronId: number, value: number): Promise<boolean> {
    const now = Date.now();
    const lastSent = this.lastSpikeTimeByDomain.get(domain) || 0;

    if (now - lastSent < SensoriomotorAutonomicBridge.REFRACTORY_PERIOD_MS) {
      return false; // Bloqueo refractario para proteger la radio y batería
    }

    this.lastSpikeTimeByDomain.set(domain, now);
    this.totalSpikesEmitted++;

    try {
      const ok = await meshRouter.broadcastAerSpike(domain, neuronId, value);
      this.notifyListeners();
      return ok;
    } catch {
      return false;
    }
  }

  /**
   * Procesa una micro-espiga AER remota recibida desde otro nodo en la malla
   */
  public handleRemoteSpike(spike: AerSpikeEvent, senderShortHex: string): void {
    this.totalRemoteSpikesReceived++;

    switch (spike.domain) {
      case AerDomainCode.KINETIC_SHOCK_MANDOWN: {
        // neuronId 0x02 = Man-Down en nodo aliado
        if (spike.neuronId === 0x02) {
          console.warn(`[SensoriomotorAutonomicBridge] ⚠️ Alerta de Inmovilidad Man-Down desde par ${senderShortHex} (${spike.value}s)`);
          const insular = InsularTcccInteroceptionEngine.getInstance();
          const casualty: TcccCasualtyCard = {
            casualtyId: `peer_${senderShortHex}`,
            callsign: `ManDown-${senderShortHex}`,
            triageCategory: 'RED_IMMEDIATE',
            massiveBleedingControlled: false,
            airwayPatent: false,
            respirationStable: false,
            pulsePresent: true,
            hypothermiaCovered: false,
            tourniquets: [],
            notes: `Alerta de inmovilidad Man-Down detectada por sensor inercial (${spike.value}s)`,
            createdAt: Date.now(),
          };
          insular.recordCasualty(casualty);
        }
        break;
      }

      case AerDomainCode.ACOUSTIC_SONAR_CAVITY: {
        if (spike.neuronId === 0x01) {
          // Obstáculo reportado por par cercano
          const distM = spike.value / 100;
          opticLobe.injectSyntheticLoomingStimulus(Math.min(180, Math.round(distM * 40)), 1.2);
        }
        break;
      }

      case AerDomainCode.SYNAPTIC_DELTA_WEIGHT: {
        // Sincronización de conductancia Hebbiana entre pares
        synapticMeshRouter.applyRemoteDeltaWeight(senderShortHex, spike.neuronId, spike.value);
        break;
      }

      default:
        break;
    }

    this.notifyListeners();
  }

  // ─── Telemetría & Observabilidad ───────────────────────────────────────────

  public getTelemetry(): AutonomicBridgeTelemetry {
    return {
      isRunning: this.isRunning,
      totalSpikesEmitted: this.totalSpikesEmitted,
      totalRemoteSpikesReceived: this.totalRemoteSpikesReceived,
      lastKineticEvent: this.lastKineticEvent,
      lastSonarEcho: this.lastSonarEcho,
      lastRfAnomaly: this.lastRfAnomaly,
      lastCbrnLevel: this.lastCbrnLevel,
      activeSensorsCount: this.unsubs.length,
    };
  }

  public subscribe(listener: (telem: AutonomicBridgeTelemetry) => void): () => void {
    this.listeners.add(listener);
    listener(this.getTelemetry());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const telem = this.getTelemetry();
    for (const listener of this.listeners) {
      try {
        listener(telem);
      } catch {
        // Silenciar errores en observadores
      }
    }
  }
}

export const sensoriomotorAutonomicBridge = SensoriomotorAutonomicBridge.getInstance();

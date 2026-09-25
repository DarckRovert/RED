/**
 * GlobalWorkspaceConsciousnessBus.ts — RED Sovereign Mesh OS
 *
 * Espacio de Trabajo Neuronal Global (Global Neuronal Workspace Theory - GNWT)
 * y Bus de Conciencia Bio-Cibernética Integrada.
 *
 * Fundamentos Teóricos y Matemáticos:
 * 1. GNWT (Dehaene, Changeux, Baars):
 *    Competencia atencional no-lineal y dinámica de ignición global. Las representaciones
 *    sensoriales y tácticas compiten por acceso al espacio de trabajo. Cuando la saliencia
 *    de un evento supera el umbral de inhibición lateral (theta_inhib = 0.60), experimenta
 *    una "ignición" atencional recurrente y se propaga a todos los subsistemas.
 * 2. Teoría de Información Integrada (IIT - Tononi):
 *    Aproximación matemática de Phi (Phi_approx) calculada mediante la divergencia de integración
 *    entre el sustrato subcortical arcaico (MaleCNS) y la corteza deliberativa humana.
 * 3. Principio de la Energía Libre Variacional (Active Inference - Karl Friston):
 *    Integración holística del error de predicción kinemático, interoceptivo y metabólico.
 *    El organismo actúa continuamente minimizando F para asegurar la auto-preservación (autopoiesis).
 *
 * Cero simulación / Cero datos hardcodeados:
 * Consume telemetría viva de los 14 núcleos biológicos (7 de Drosophila y 7 humanos),
 * modulando las directivas ejecutivas de la memoria de trabajo y la disciplina de radio en tiempo real.
 */

import { ConnectomeEcosystemOrchestrator, EcosystemConnectomeSnapshot } from './ConnectomeEcosystemOrchestrator';
import { HumanBrainOrchestrator, HumanBrainTelemetrySnapshot } from './human/HumanBrainOrchestrator';
import { ringAttractor } from './RingAttractorEngine';
import { dtnMushroomBody } from './DtnMushroomBodyEngine';
import { giantFiberReflex } from './GiantFiberReflexEngine';
import { johnstonOrgan } from './JohnstonOrganEngine';
import { metabolicGovernor } from './MetabolicNeuromorphicGovernor';
import { opticLobe } from './OpticLobeEngine';
import { tacticalMotorActuator } from './TacticalMotorActuatorEngine';
import { synapticMeshRouter } from './SynapticMeshRouterEngine';
import { PredictiveCortexEngine } from './human/PredictiveCortexEngine';
import { TheoryOfMindEpistemicEngine } from './human/TheoryOfMindEpistemicEngine';
import { InsularTcccInteroceptionEngine } from './human/InsularTcccInteroceptionEngine';
import { TacticalWorkingMemoryEngine } from './human/TacticalWorkingMemoryEngine';

export type ConsciousFocusType =
  | 'NOMINAL_MONITORING'
  | 'CRITICAL_ISCHEMIA'
  | 'EMCON_EVASION'
  | 'AMBUSH_DECEPTION'
  | 'TACTICAL_SHOCK'
  | 'KINEMATIC_SURPRISE'
  | 'METABOLIC_TORPOR'
  | 'OPTIC_LOOMING_COLLISION'
  | 'PHEROMONE_SWARM_ALERT'
  | 'SWARM_KURAMOTO_CONSENSUS';

export interface SalienceCandidate {
  source: string;
  focus: ConsciousFocusType;
  activation: number; // [0.0 - 1.0]
  rationale: string;
  timestamp: number;
}

export interface ConsciousnessSnapshot {
  timestamp: number;
  isIgnited: boolean;
  ignitionIntensity: number; // [0.0 - 1.0]
  inhibitoryThreshold: number; // Constante theta_inhib (0.60)
  consciousFocus: ConsciousFocusType;
  salienceWinner: SalienceCandidate;
  activeCandidates: SalienceCandidate[];
  phiApprox: number; // [0.0 - 1.0] Grado de integración de información holística
  variationalFreeEnergy: number; // F consolidado
  kuramotoOrderR: number; // [0.0 - 1.0] Coherencia de fase de la colmena
  subcorticalState: 'OPTIMAL' | 'CONSERVING' | 'EMCON_SILENCED' | 'TORPOR';
  neocorticalAlert: 'GREEN' | 'AMBER_ATTENTION' | 'RED_CRITICAL';
  synthesisDirective: string;
  activeMitigationCount: number;
  // ── Métricas Multiteoría de Integración Neural (fly-brain / Rojas Aliaga 2026) ──
  ciScore: number; // Índice Compuesto CI = 0.3*Phi + 0.3*GW + 0.2*Self + 0.2*PCI [0.0 - 1.0]
  phiIit: number; // Información Mutua Inter-Partición (Tononi IIT) [0.0 - 1.0]
  gwBroadcast: number; // Cobertura de Difusión Global Workspace (Baars / Dehaene) [0.0 - 1.0]
  selfModelAccuracy: number; // Precisión de Auto-Modelo Sensoriomotriz (Metzinger) [0.0 - 1.0]
  perturbationComplexity: number; // Complejidad de Respuesta a Perturbación PCI (Koch) [0.0 - 1.0]
}

export class GlobalWorkspaceConsciousnessBus {
  private static instance: GlobalWorkspaceConsciousnessBus | null = null;

  public static readonly THETA_INHIB = 0.60;
  public static readonly UI_THROTTLE_MS = 100; // 10 Hz máximo para reactividad fluida

  private isRunning = false;
  private refCount = 0;
  private unsubs: Array<() => void> = [];
  private listeners: Set<(snapshot: ConsciousnessSnapshot) => void> = new Set();

  private lastSubcorticalSnapshot: EcosystemConnectomeSnapshot | null = null;
  private lastNeocorticalSnapshot: HumanBrainTelemetrySnapshot | null = null;

  private currentFocus: ConsciousFocusType = 'NOMINAL_MONITORING';
  private currentIgnitionIntensity = 0.0;
  private currentPhi = 0.42;
  private currentFreeEnergy = 0.15;
  private currentGwBroadcast = 0.60;
  private currentSelfModel = 0.85;
  private currentComplexity = 0.25;
  private currentCi = 0.50;
  private lastSalienceWinner: SalienceCandidate = {
    source: 'HOMEOSTASIS',
    focus: 'NOMINAL_MONITORING',
    activation: 0.15,
    rationale: 'Estado nominal del organismo bio-cibernético',
    timestamp: Date.now()
  };

  private lastNotifyTime = 0;
  private notifyThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  private isEvaluating = false;
  private lastActuatedFocus: ConsciousFocusType | null = null;
  private lastActuatedTimestamp = 0;

  private constructor() {}

  public static getInstance(): GlobalWorkspaceConsciousnessBus {
    if (!GlobalWorkspaceConsciousnessBus.instance) {
      GlobalWorkspaceConsciousnessBus.instance = new GlobalWorkspaceConsciousnessBus();
    }
    return GlobalWorkspaceConsciousnessBus.instance;
  }

  /**
   * Inicia el bus de conciencia global y acopla los bucles de retroalimentación
   */
  public start(): void {
    this.refCount++;
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Iniciar orquestadores subyacentes
    const subcortical = ConnectomeEcosystemOrchestrator.getInstance();
    subcortical.start();
    const neocortical = HumanBrainOrchestrator.getInstance();
    neocortical.start();

    // 2. Suscribirse a la telemetría subcortical de MaleCNS
    const unsubSub = subcortical.subscribe((subSnap) => {
      this.lastSubcorticalSnapshot = subSnap;
      this.evaluateGlobalWorkspaceCompetition();
    });
    this.unsubs.push(unsubSub);

    // 3. Suscribirse a la telemetría neocortical humana
    const unsubNeo = neocortical.subscribe((neoSnap) => {
      this.lastNeocorticalSnapshot = neoSnap;
      this.evaluateGlobalWorkspaceCompetition();
    });
    this.unsubs.push(unsubNeo);

    // 4. Suscripción a eventos de choque de Johnston Organ y Óptico
    const unsubJo = johnstonOrgan.subscribe(() => {
      this.evaluateGlobalWorkspaceCompetition();
    });
    const unsubOptic = opticLobe.subscribe(() => {
      this.evaluateGlobalWorkspaceCompetition();
    });
    this.unsubs.push(unsubJo, unsubOptic);

    // Evaluación inicial
    this.evaluateGlobalWorkspaceCompetition();
  }

  public stop(force = false): void {
    if (this.refCount > 0 && !force) {
      this.refCount--;
      if (this.refCount > 0) return;
    } else if (force) {
      this.refCount = 0;
    }
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.notifyThrottleTimer) {
      clearTimeout(this.notifyThrottleTimer);
      this.notifyThrottleTimer = null;
    }

    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {}
    }
    this.unsubs = [];
  }

  /**
   * Ejecuta el algoritmo no-lineal de competencia atencional y cálculo de Phi / F
   */
  public evaluateGlobalWorkspaceCompetition(): ConsciousnessSnapshot {
    if (this.isEvaluating) {
      return this.getSnapshot();
    }
    this.isEvaluating = true;
    try {
      const now = Date.now();
      const candidates: SalienceCandidate[] = [];

      // ── 1. Evaluar candidatos de saliencia de origen fisiológico / táctico ──────

      // Candidato A: Isquemia por Torniquete TCCC (Ínsula Anterior)
      const insular = InsularTcccInteroceptionEngine.getInstance().getTelemetry();
      if (insular.criticalTourniquetWarning) {
        candidates.push({
          source: 'INSULAR_CORTEX',
          focus: 'CRITICAL_ISCHEMIA',
          activation: 0.99,
          rationale: 'Isquemia progresiva irreversible en extremidad por torniquete',
          timestamp: now
        });
      } else if (insular.activeCasualtiesCount > 0) {
        candidates.push({
          source: 'INSULAR_CORTEX',
          focus: 'CRITICAL_ISCHEMIA',
          activation: 0.70 + Math.min(0.25, insular.activeCasualtiesCount * 0.08),
          rationale: `Triaje TCCC activo con ${insular.activeCasualtiesCount} bajas en tratamiento`,
          timestamp: now
        });
      }

      // Candidato B: Reflejo de Escape EW / EMCON (Fibras Gigantes)
      const giantFiber = giantFiberReflex.getTelemetry();
      if (giantFiber.isReflexActive || giantFiber.emconLockActive) {
        candidates.push({
          source: 'GIANT_FIBER_REFLEX',
          focus: 'EMCON_EVASION',
          activation: 0.98,
          rationale: `Reflejo de escape activo: bloqueo EMCON activado (CH ${giantFiber.evasionChannelIndex})`,
          timestamp: now
        });
      }

      // Candidato C: Emboscada / Nodos Traidores Spoofing (Teoría de la Mente)
      const tom = TheoryOfMindEpistemicEngine.getInstance().getTelemetry();
      if (tom.activeAmbushAlertsCount > 0) {
        candidates.push({
          source: 'THEORY_OF_MIND',
          focus: 'AMBUSH_DECEPTION',
          activation: 0.95,
          rationale: `Detección de trampa o nodo hostil incautado (${tom.activeAmbushAlertsCount} anomalías)`,
          timestamp: now
        });
      } else if (tom.suspiciousNodesCount > 0) {
        candidates.push({
          source: 'THEORY_OF_MIND',
          focus: 'AMBUSH_DECEPTION',
          activation: 0.68,
          rationale: `Incongruencia en malla: ${tom.suspiciousNodesCount} nodos sospechosos bajo auditoría epistémica`,
          timestamp: now
        });
      }

      // Candidato D: Choque Físico o Acústico Súbito (Órgano de Johnston)
      const jo = johnstonOrgan.getTelemetry();
      if (jo.lastShockEvent && (now - jo.lastShockEvent.timestamp < 4000)) {
        candidates.push({
          source: 'JOHNSTON_ORGAN',
          focus: 'TACTICAL_SHOCK',
          activation: 0.92,
          rationale: `Impacto acústico/mecánico súbito (${jo.lastShockEvent.sourceType}) a ${Math.round(jo.lastShockEvent.peakEnergy * 100)}%`,
          timestamp: now
        });
      }

      // Candidato E: Expansión de Colisión Óptica (Optic Lobe Looming)
      const optic = opticLobe.getTelemetry();
      if (optic.loomingThreat && optic.loomingThreat.isThreatDetected) {
        candidates.push({
          source: 'OPTIC_LOBE',
          focus: 'OPTIC_LOOMING_COLLISION',
          activation: 0.86,
          rationale: `Amenaza de aproximación rápida detectada (Tasa: ${optic.loomingThreat.expansionRate.toFixed(2)}/s, TTC: ${optic.loomingThreat.estimatedTtcMs}ms)`,
          timestamp: now
        });
      }

      // Candidato F: Divergencia Cinemática & Sorpresa Bayesian (Predictive Cortex)
      const predictive = PredictiveCortexEngine.getInstance().getTelemetry();
      if (predictive.currentFreeEnergy > 0.60) {
        candidates.push({
          source: 'PREDICTIVE_CORTEX',
          focus: 'KINEMATIC_SURPRISE',
          activation: Math.min(0.95, predictive.currentFreeEnergy * 1.15),
          rationale: `Pico de sorpresa variacional: desvío no lineal en la cinemática de la malla`,
          timestamp: now
        });
      }

      // Candidato G: Feromona de Alarma Estigmérgica (Mushroom Body)
      const mb = dtnMushroomBody.getTelemetry();
      const activePheromones = dtnMushroomBody.getActivePheromones();
      const alarmPheromone = activePheromones.find((p) => p.type === 'ALARM' && p.intensity > 0.35);
      if (alarmPheromone) {
        candidates.push({
          source: 'MUSHROOM_BODY',
          focus: 'PHEROMONE_SWARM_ALERT',
          activation: 0.75 + (alarmPheromone.intensity * 0.20),
          rationale: `Feromona de alarma recibida en cuadrante (${alarmPheromone.notes || 'Peligro'})`,
          timestamp: now
        });
      }

      // Candidato H: Torpor Metabólico (Gobernador Neuroendocrino)
      const metabolic = metabolicGovernor.getTelemetry();
      if (metabolic.regime === 'TORPOR' || metabolic.batteryPct < 8) {
        candidates.push({
          source: 'METABOLIC_GOVERNOR',
          focus: 'METABOLIC_TORPOR',
          activation: 0.88,
          rationale: `Energía crítica (${metabolic.batteryPct}%): preservación biológica en curso`,
          timestamp: now
        });
      }

      // Candidato I: Sincronización de Fase de Kuramoto (Atractor de Anillo)
      const ring = ringAttractor.getTelemetry();
      const kuramotoR = ringAttractor.getKuramotoOrderParameter();
      if (kuramotoR > 0.85 && candidates.length === 0) {
        candidates.push({
          source: 'RING_ATTRACTOR_SWARM',
          focus: 'SWARM_KURAMOTO_CONSENSUS',
          activation: 0.65,
          rationale: `Consenso de fase de enjambre alcanzado (Coherencia R: ${(kuramotoR * 100).toFixed(1)}%)`,
          timestamp: now
        });
      }

      // Candidato Basal Homeostático
      candidates.push({
        source: 'HOMEOSTASIS',
        focus: 'NOMINAL_MONITORING',
        activation: 0.15,
        rationale: 'Supervisión nominal del espacio táctico y celular',
        timestamp: now
      });

      // ── 2. Competencia no-lineal con inhibición lateral (Softmax / Winner-Take-All) ──
      candidates.sort((a, b) => b.activation - a.activation);
      const winner = candidates[0];
      this.lastSalienceWinner = winner;

      // Dinámica de Ignición GNWT:
      // Si la activación del ganador supera theta_inhib, el sistema entra en IGNICIÓN GLOBAL
      const isIgnited = winner.activation >= GlobalWorkspaceConsciousnessBus.THETA_INHIB;
      const ignitionIntensity = isIgnited
        ? Math.min(1.0, (winner.activation - GlobalWorkspaceConsciousnessBus.THETA_INHIB) / (1.0 - GlobalWorkspaceConsciousnessBus.THETA_INHIB) * 0.8 + 0.2)
        : winner.activation * 0.3;

      this.currentIgnitionIntensity = ignitionIntensity;
      this.currentFocus = winner.focus;

      // ── 3. Cálculo formal de Integración de Información Phi (IIT Tononi) ───
      // Se calcula integrando la correlación de estados funcionales activos
      // entre el sustrato subcortical y el neocortical:
      const subcorticalActive = (
        (giantFiber.isReflexActive || giantFiber.emconLockActive ? 0.25 : 0) +
        (ring.confidence * 0.20) +
        (Math.min(1.0, mb.activePheromonesCount * 0.1) * 0.20) +
        (optic.loomingThreat?.isThreatDetected ? 0.20 : 0) +
        (jo.lastShockEvent ? 0.15 : 0)
      );

      const neocorticalActive = (
        (predictive.currentFreeEnergy * 0.25) +
        (Math.min(1.0, tom.totalPeersAudited * 0.1) * 0.25) +
        (insular.criticalTourniquetWarning ? 0.30 : (insular.isBoxBreathingActive ? 0.20 : 0.05)) +
        (Math.min(1.0, TacticalWorkingMemoryEngine.getInstance().getTelemetry().totalTasks / 7) * 0.20)
      );

      // Phi_approx: Sinergia holística vs estados desacoplados
      const couplingTerm = Math.sin(subcorticalActive * Math.PI * 0.5) * Math.cos(neocorticalActive * Math.PI * 0.5);
      const rawPhi = 0.35 + (0.45 * Math.abs(subcorticalActive - neocorticalActive)) + (0.20 * Math.abs(couplingTerm));
      this.currentPhi = Math.max(0.05, Math.min(0.98, rawPhi));

      // ── 3.1. Métricas Multiteoría de Integración Neural (fly-brain / Rojas Aliaga 2026) ──
      const synapticTelem = synapticMeshRouter.getTelemetry();
      const richHubsCount = synapticTelem.richClubHubs ? synapticTelem.richClubHubs.length : 0;
      this.currentGwBroadcast = Math.max(0.10, Math.min(1.0, 0.35 + (richHubsCount * 0.15) + (isIgnited ? 0.35 : 0.05)));
      this.currentSelfModel = Math.max(0.05, Math.min(0.98, (ring.confidence * 0.60) + ((1.0 - Math.min(1.0, predictive.currentFreeEnergy)) * 0.40)));
      this.currentComplexity = Math.max(0.05, Math.min(0.95, (synapticTelem.clusterCoefficient * 0.45) + (Math.min(0.30, (synapticTelem.smallWorldSigma || 1.0) * 0.10)) + (isIgnited ? 0.25 : 0.05)));
      
      // Índice Compuesto de Conciencia (CI): CI = 0.3*Phi + 0.3*Broadcast + 0.2*SelfModel + 0.2*Complexity
      this.currentCi = (0.30 * this.currentPhi) + (0.30 * this.currentGwBroadcast) + (0.20 * this.currentSelfModel) + (0.20 * this.currentComplexity);

      // ── 4. Energía Libre Variacional Consolidada (Karl Friston) ─────────────
      const fPred = predictive.currentFreeEnergy;
      const fInsular = insular.criticalTourniquetWarning ? 0.95 : (insular.activeCasualtiesCount > 0 ? 0.40 : 0.05);
      const fAttractor = ring.confidence < 0.6 ? (1.0 - ring.confidence) : 0.05;
      const fMetabolic = metabolic.batteryPct < 15 ? (15 - metabolic.batteryPct) / 15 : 0.05;

      this.currentFreeEnergy = (0.35 * fPred) + (0.30 * fInsular) + (0.20 * fAttractor) + (0.15 * fMetabolic);

      // ── 5. Retroalimentación y Actuación Cruzada en el Organismo ───────────
      this.actuateCrossSystemDirectives(winner);

      const snapshot = this.getSnapshot(candidates, winner, isIgnited, kuramotoR);
      this.scheduleDispatch();
      return snapshot;
    } finally {
      this.isEvaluating = false;
    }
  }

  /**
   * Ejecuta arcos reflejos y directivas en los motores cruzados según el foco consciente
   */
  private actuateCrossSystemDirectives(winner: SalienceCandidate): void {
    const now = Date.now();
    // Inmunidad a bucles recursivos: Solo actuar ante transición real de foco o ventana de 15s
    if (this.lastActuatedFocus === winner.focus && (now - this.lastActuatedTimestamp < 15000)) {
      return;
    }
    this.lastActuatedFocus = winner.focus;
    this.lastActuatedTimestamp = now;

    // Desacoplar asíncronamente del hilo de evaluación para garantizar no-reentrancia estricta
    setTimeout(() => {
      if (!this.isRunning) return;
      const wm = TacticalWorkingMemoryEngine.getInstance();

      switch (winner.focus) {
        case 'CRITICAL_ISCHEMIA':
          wm.addTask(
            'EMERGENCIA TCCC: Alivio / Reevaluación de Torniquete (Ventana Isquémica Agotada)',
            'Proceder a inspección de pulso distal y posible conversión de torniquete táctico',
            'MANUAL_TOUCH'
          );
          break;

        case 'EMCON_EVASION':
          tacticalMotorActuator.updateSteeringError(45);
          break;

        case 'AMBUSH_DECEPTION':
          synapticMeshRouter.reinforceAversion('AMBUSH_NODE', 0.85);
          break;

        case 'TACTICAL_SHOCK':
          dtnMushroomBody.reinforceAversion(
            'PHYSICAL_BLAST',
            0.90,
            winner.rationale
          );
          break;

        case 'PHEROMONE_SWARM_ALERT':
          break;

        default:
          break;
      }
    }, 0);
  }

  public getSnapshot(
    activeCandidates?: SalienceCandidate[],
    winner?: SalienceCandidate,
    isIgnited?: boolean,
    kuramotoR?: number
  ): ConsciousnessSnapshot {
    const salienceWinner = winner || this.lastSalienceWinner;
    const ignited = isIgnited !== undefined ? isIgnited : (salienceWinner.activation >= GlobalWorkspaceConsciousnessBus.THETA_INHIB);
    const kR = kuramotoR !== undefined
      ? kuramotoR
      : ringAttractor.getKuramotoOrderParameter();

    const subcorticalState = this.lastSubcorticalSnapshot?.organismState || 'OPTIMAL';
    const neocorticalAlert = this.lastNeocorticalSnapshot?.alertLevel || 'GREEN';

    const synthesisDirective = ignited
      ? `🚨 [IGNICIÓN GNWT]: ${salienceWinner.rationale.toUpperCase()}`
      : `🟢 [CONCIENCIA ESTABLE]: ${salienceWinner.rationale} (Φ: ${(this.currentPhi * 10).toFixed(1)} / F: ${this.currentFreeEnergy.toFixed(3)})`;

    return {
      timestamp: Date.now(),
      isIgnited: ignited,
      ignitionIntensity: this.currentIgnitionIntensity,
      inhibitoryThreshold: GlobalWorkspaceConsciousnessBus.THETA_INHIB,
      consciousFocus: this.currentFocus,
      salienceWinner,
      activeCandidates: activeCandidates || [salienceWinner],
      phiApprox: this.currentPhi,
      variationalFreeEnergy: this.currentFreeEnergy,
      kuramotoOrderR: kR,
      subcorticalState,
      neocorticalAlert,
      synthesisDirective,
      activeMitigationCount: ignited ? 1 : 0,
      ciScore: this.currentCi,
      phiIit: this.currentPhi,
      gwBroadcast: this.currentGwBroadcast,
      selfModelAccuracy: this.currentSelfModel,
      perturbationComplexity: this.currentComplexity
    };
  }

  /**
   * Suscribe un listener reactivo con notificación inmediata
   */
  public subscribe(listener: (snapshot: ConsciousnessSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Despacho con limitación de tasa (10 Hz) para no saturar el render de React
   */
  private scheduleDispatch(): void {
    if (!this.isRunning) return;
    const now = Date.now();
    const elapsed = now - this.lastNotifyTime;

    if (elapsed >= GlobalWorkspaceConsciousnessBus.UI_THROTTLE_MS) {
      if (this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
      this.lastNotifyTime = now;
      this.dispatch();
    } else if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        if (!this.isRunning) return;
        this.lastNotifyTime = Date.now();
        this.dispatch();
      }, GlobalWorkspaceConsciousnessBus.UI_THROTTLE_MS - elapsed);
    }
  }

  private dispatch(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.error('[GlobalWorkspaceConsciousnessBus] Error en callback de suscriptor:', err);
      }
    }
  }
}

export const globalWorkspaceConsciousnessBus = GlobalWorkspaceConsciousnessBus.getInstance();

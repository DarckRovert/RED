/**
 * BiocyberneticHabitatEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Orquestador Central del Hábitat Digital Biocibernético In-Silico.
 * 
 * Gestiona el sustrato físico-químico determinista a 60 Hz fijos (Time Accumulator Pattern),
 * el ciclo vital y ecológico de múltiples organismos neurofisiológicos:
 * - Drosophila melanogaster: marcha trípode 18-DOF, alas oscilantes, omatidios LC4 y Hebbian STDP.
 * - Caenorhabditis elegans: cuerpo sinusoidal flexible de 10 nodos, quimiotaxis por klinokinesis
 *   (Pierce-Shimomura et al., 1999) y aversión nociceptiva térmica (FLP/PVD).
 * - Ant (Formicidae): forrajeo de glucosa, estigmergia con deposición continua de feromona
 *   de rastro (PHEROMONE_TRAIL) en la grilla de Fick y convergencia de rutas colectivas.
 * - Ciclo de vida A-Life: reproducción/mitosis por saciedad con mutación genética gaussiana,
 *   y biodegradación de biomasa orgánica tras la muerte celular.
 * - Instrumental táctico: Pipeta continua (Drag & Paint), Sonda Mecánica (Air Puff Poke),
 *   Barreras Acústicas reflectoras Neumann, Foco Térmico, Láser Optogenético y Sombras Looming.
 */

import { FickDiffusionGrid, ChemicalSubstance, ChemicalSource, AcousticBarrier } from './FickDiffusionGrid';
import { BiocyberneticMetabolismEngine, MetabolicTelemetry } from './BiocyberneticMetabolismEngine';
import { OmmatidialCompoundEye, CompoundEyeTelemetry } from './OmmatidialCompoundEye';
import { PersistentSynapticPlasticityEngine } from './PersistentSynapticPlasticityEngine';
import { HabitatMeshBridgeEngine, ImmigrantOrganismData } from './HabitatMeshBridgeEngine';
import { kineticStress } from '../../sensors/KineticStressEngine';
import { hexapodActuatorBridge } from '../vivarium/HexapodActuatorBridgeEngine';
import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';
import { connectomeBioBridge } from '../ConnectomeBioBridge';
import { giantFiberReflex } from '../GiantFiberReflexEngine';
import { autonomousHabitatChess, AutonomousHabitatChessEngine, ChessMove } from './AutonomousHabitatChessEngine';
import { biocyberneticEdenParadise, BiocyberneticEdenParadiseEngine, EdenParadiseTelemetry } from './BiocyberneticEdenParadiseEngine';
import { autonomousLifelongLearning, AutonomousLifelongLearningEngine, LifelongLearningTelemetry } from './AutonomousLifelongLearningEngine';
import {
  OrganismGenome,
  createInitialGenome,
  inheritGenomeWithMutation,
  computeFitnessScore,
  EvolutionChronicleEntry,
  PopulationGeneticsTelemetry,
} from './OrganismGenome';
export * from './OrganismGenome';
import {
  BiocyberneticMetropolisEngine,
  CivilianCaste,
  MetropolisTelemetry,
  UrbanStructureType,
  UrbanStructure,
} from './BiocyberneticMetropolisEngine';
export * from './BiocyberneticMetropolisEngine';

/**
 * Normaliza un ángulo en radianes al rango canónico [0, 2π)
 */
export function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
}

/**
 * Calcula la diferencia angular más corta entre dos rumbos en el rango [-π, π]
 */
export function shortestAngleDiff(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export type OrganismSpecies = 'DROSOPHILA' | 'C_ELEGANS' | 'ANT' | 'HUMAN_NEOCORTEX' | 'GRAVITY_SENTINEL';

export type OrganismMood =
  | 'HUNGRY'
  | 'CURIOUS'
  | 'VIGILANT'
  | 'ENERGETIC'
  | 'PLAYFUL'
  | 'ZEN'
  | 'COMPETITIVE'
  | 'SERENITY'
  | 'TRANSCENDENCE'
  | 'DREAMING';

export interface SugarRaceState {
  isActive: boolean;
  targetX: number;
  targetY: number;
  timeRemainingSec: number;
  winnerSpecies: OrganismSpecies | null;
  winnerName: string | null;
  announcement: string;
}

export interface CognitiveThoughtEntry {
  id: string;
  species: OrganismSpecies;
  name: string;
  thought: string;
  mood: OrganismMood;
  timestamp: number;
}

export interface HabitatOrganism {
  id: string;
  species: OrganismSpecies;
  x: number; // Coordenadas en metros dentro del hábitat [-10, 10]
  y: number;
  z: number;
  headingRad: number;
  speedMps: number;
  generation: number;
  metabolism: BiocyberneticMetabolismEngine;
  eye: OmmatidialCompoundEye;
  plasticity: PersistentSynapticPlasticityEngine;
  isLeader: boolean;
  legAnglesDeg: number[]; // 18-DOF articulaciones para robótica física
  // Especialización biológica divergente
  sinusoidalPhase: number;
  wormJoints: Array<{ x: number; y: number }>;
  lastConcentration: number;
  pirouetteTimerSec: number;
  isCarryingFood: boolean;
  satietyTimerSec: number;
  isDecomposing: boolean;
  decompositionRemainingSec: number;
  behaviorState: string;
  wingFlapPhase: number;
  nestExitCooldownSec: number;
  // Cognición, emociones y entretenimiento L9
  currentThought: string;
  thoughtTimerSec: number;
  mood: OrganismMood;
  personality: string;
  altitudeMeters: number;
  laserChaseTarget: { x: number; y: number } | null;
  acrobaticTimerSec: number;
  pettedTimerSec: number;
  // Sabiduría y Aprendizaje Permanente en el Paraíso
  wisdomLevel: number;
  curiosityScore: number;
  isDreaming: boolean;
  sleepReplayTicks: number;
  // Genoma Cuantitativo y Dinámica Evolutiva A-Life L9
  genome: OrganismGenome;
  ageSec: number;
  atpCollectedTotal: number;
  offspringCount: number;
  trophallaxisTimerSec: number;
  // Urbanismo Estigmérgico y Metrópolis Biocibernética
  caste: CivilianCaste;
  biopolymerCarried: number;
  civicJob?: import('./BiocyberneticMetropolisEngine').CivicJobType;
  homeStructureId?: string;
  workplaceStructureId?: string;
  dailySchedulePhase?: import('./BiocyberneticMetropolisEngine').DailySchedulePhase;
  flightAltitudeTargetMeters?: number;
  civicTargetX?: number;
  civicTargetY?: number;
  civicActionDescription?: string;
  // Ontogénesis, Billetera Cívica y Cognición BDI
  lifeStage?: 'EGG' | 'LARVA' | 'PUPA' | 'ADULT_IMAGO';
  stageProgressPercent?: number;
  microAtpWallet?: number;
  homeCellId?: string;
  airCorridorTargetNodeId?: string | null;
  bdiBeliefSummary?: string;
  bdiDesire?: string;
  bdiIntention?: string;
}

export type HabitatToolType =
  | 'NONE'
  | 'GLUCOSE_PIPETTE'
  | 'HEAT_INFRARED'
  | 'OPTOGENETIC_CHR2'
  | 'LOOMING_SHADOW'
  | 'AIR_PUFF_POKE'
  | 'ACOUSTIC_BARRIER'
  | 'OPTOGENETIC_LASER';

export interface TacticalToolState {
  activeTool: HabitatToolType;
  intensity: number; // [0.0 - 1.0]
  cursorX: number;   // Metros en arena
  cursorY: number;
}

export interface ShadowProjector {
  id: string;
  x: number;
  y: number;
  z: number;
  radiusMeters: number;
  velocityMps: number;
  durationSec: number;
}

export interface AirPuffWave {
  id: string;
  x: number;
  y: number;
  radiusMeters: number;
  maxRadiusMeters: number;
  strength: number;
  durationSec: number;
}

export interface HabitatTelemetry {
  organismCount: number;
  leaderAtp: number;
  leaderGlucose: number;
  leaderState: string;
  leaderSpecies: OrganismSpecies;
  totalChemicalMassInGrid: number;
  activeSourcesCount: number;
  fickSimulationTimeSec: number;
  isActuatorStreaming: boolean;
  activeTool: HabitatToolType;
  p2pMigrationsEmitted: number;
  p2pMigrationsReceived: number;
  barrierCount: number;
  activeWavesCount: number;
  speciesBreakdown: {
    drosophila: number;
    cElegans: number;
    ant: number;
    humanNeocortex: number;
    gravitySentinel: number;
  };
  sugarRace: SugarRaceState;
  recentThoughts: CognitiveThoughtEntry[];
  chessMatch: {
    isActive: boolean;
    isPaused: boolean;
    whiteSpecies: OrganismSpecies;
    blackSpecies: OrganismSpecies;
    whiteName: string;
    blackName: string;
    currentTurn: 'w' | 'b';
    winner: 'w' | 'b' | 'draw' | null;
    moveCount: number;
    lastMoveSan: string | null;
    fen: string;
  };
  edenParadise: EdenParadiseTelemetry;
  lifelongLearning: LifelongLearningTelemetry;
  timeScale: number;
  maxGeneration: number;
  populationGenetics: PopulationGeneticsTelemetry;
  evolutionChronicle: EvolutionChronicleEntry[];
  metropolis: MetropolisTelemetry;
}

export class BiocyberneticHabitatEngine {
  private static instance: BiocyberneticHabitatEngine | null = null;

  public static readonly ARENA_RADIUS_METERS = 24.0;
  public static readonly ARENA_DIAMETER_METERS = 48.0;
  public static readonly FIXED_TIMESTEP_SEC = 1.0 / 60.0; // 60 Hz exactos (~16.66 ms)
  public static readonly MAX_PHYSICS_SUB_STEPS = 3; // Prevenir "Spiral of Death" en hardware móvil
  private static readonly TELEMETRY_INTERVAL_SEC = 0.1; // 10 Hz para HUD y React

  public readonly diffusionGrid: FickDiffusionGrid;
  public readonly meshBridge: HabitatMeshBridgeEngine;
  public readonly metropolisEngine: BiocyberneticMetropolisEngine;

  private organisms: Map<string, HabitatOrganism> = new Map();
  private shadows: ShadowProjector[] = [];
  private airPuffWaves: AirPuffWave[] = [];
  private activeToolState: TacticalToolState = {
    activeTool: 'NONE',
    intensity: 1.0,
    cursorX: 0,
    cursorY: 0,
  };

  private isRunning = false;
  private simTimeSec = 0;
  private accumulator = 0;
  private lastFrameTimestamp = 0;
  private lastTelemetryTimeSec = 0;
  private animFrameId: any = null;

  private isActuatorStreaming = false;
  private kineticStressUnsub: (() => void) | null = null;
  private meshBridgeUnsub: (() => void) | null = null;

  private telemetryListeners: Set<(t: HabitatTelemetry) => void> = new Set();

  private sugarRace: SugarRaceState = {
    isActive: false,
    targetX: 0,
    targetY: 0,
    timeRemainingSec: 0,
    winnerSpecies: null,
    winnerName: null,
    announcement: 'Ecosistema en equilibrio simbiótico.',
  };
  private recentThoughts: CognitiveThoughtEntry[] = [];
  private laserChaseGlobalTarget: { x: number; y: number } | null = null;
  private laserChaseTimerSec = 0;

  // ── Dinámica de Evolución y Genómica A-Life L9 ──────────────────────────────
  private timeScale: number = 1.0;
  private evolutionChronicle: EvolutionChronicleEntry[] = [];
  private maxGenerationReached: number = 1;
  private totalBirths: number = 0;
  private totalDeaths: number = 0;
  private lineageCounter: number = 1;
  private environmentalStressMultiplier: number = 1.0;
  private autoSporeCooldownSec: number = 0;

  public addEvolutionChronicle(entry: Omit<EvolutionChronicleEntry, 'id' | 'timestampSec'>): void {
    const fullEntry: EvolutionChronicleEntry = {
      id: `chron-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestampSec: Math.round(this.simTimeSec),
      ...entry,
    };
    this.evolutionChronicle.unshift(fullEntry);
    if (this.evolutionChronicle.length > 50) {
      this.evolutionChronicle.pop();
    }
  }

  public getEvolutionChronicle(): EvolutionChronicleEntry[] {
    return [...this.evolutionChronicle];
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, Math.min(10.0, scale));
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public getPopulationGenetics(): PopulationGeneticsTelemetry {
    let speedSum = 0;
    let metaSum = 0;
    let sensorySum = 0;
    let longevitySum = 0;
    let coopSum = 0;
    let count = 0;
    const lineageCounts = new Map<string, number>();

    for (const org of this.organisms.values()) {
      if (org.isDecomposing) continue;
      count++;
      speedSum += org.genome.speedGene;
      metaSum += org.genome.metabolicEfficiencyGene;
      sensorySum += org.genome.sensoryRadiusGene;
      longevitySum += org.genome.longevityGene;
      coopSum += org.genome.cooperationGene;
      lineageCounts.set(org.genome.lineageId, (lineageCounts.get(org.genome.lineageId) || 0) + 1);
    }

    let topLineage = 'LIN-DROS-01';
    let maxLCount = 0;
    for (const [lin, c] of lineageCounts.entries()) {
      if (c > maxLCount) {
        maxLCount = c;
        topLineage = lin;
      }
    }

    return {
      totalBirths: this.totalBirths,
      totalDeaths: this.totalDeaths,
      maxGeneration: this.maxGenerationReached,
      activeLineagesCount: lineageCounts.size,
      meanSpeedGene: count > 0 ? Math.round((speedSum / count) * 100) / 100 : 1.0,
      meanMetabolicEfficiency: count > 0 ? Math.round((metaSum / count) * 100) / 100 : 1.0,
      meanSensoryRadius: count > 0 ? Math.round((sensorySum / count) * 100) / 100 : 1.0,
      meanLongevitySec: count > 0 ? Math.round(longevitySum / count) : 180,
      meanCooperationGene: count > 0 ? Math.round((coopSum / count) * 100) / 100 : 0.5,
      topLineageId: topLineage,
    };
  }

  public forceAssistMitosis(organismId: string): HabitatOrganism | null {
    const org = this.organisms.get(organismId);
    if (!org || org.isDecomposing) return null;
    org.offspringCount++;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 0.85 + Math.random() * 0.4;
    const offspring = this.spawnOrganism(
      org.species,
      org.x + Math.cos(spawnAngle) * spawnDist,
      org.y + Math.sin(spawnAngle) * spawnDist,
      spawnAngle,
      false,
      org.genome,
      org.id
    );
    offspring.plasticity.inheritFromParentWithMutation(org.plasticity, org.genome.mutationRateGene * 1.5);
    TacticalAudioEngine.playMitosisChime();
    return offspring;
  }

  public triggerEnvironmentalSporeBloom(x?: number, y?: number): void {
    const targetX = x !== undefined ? x : (Math.random() - 0.5) * 8;
    const targetY = y !== undefined ? y : (Math.random() - 0.5) * 8;
    const centerOffset = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
    this.diffusionGrid.injectChemical(targetX + centerOffset, targetY + centerOffset, 45.0, 'GLUCOSE');
    this.addEvolutionChronicle({
      type: 'BIRTH',
      species: 'DROSOPHILA',
      organismId: 'environment',
      generation: this.maxGenerationReached,
      lineageId: 'ECOSYSTEM',
      headline: '🌾 Brote Masivo de Esporas de Glucosa',
      detail: `Saturación de nutrientes en (${targetX.toFixed(1)}, ${targetY.toFixed(1)}). Quimiotaxis competitiva en curso.`,
    });
  }

  public triggerMutagenicCosmicRay(): void {
    this.environmentalStressMultiplier = 2.5;
    setTimeout(() => {
      this.environmentalStressMultiplier = 1.0;
    }, 10000);
    this.addEvolutionChronicle({
      type: 'MUTATION_BREAKTHROUGH',
      species: 'GRAVITY_SENTINEL',
      organismId: 'cosmic-flux',
      generation: this.maxGenerationReached,
      lineageId: 'ENVIRONMENT',
      headline: '⚡ Pulso Cósmico Mutagénico Inyectado',
      detail: 'Tasa de mutación celular incrementada a 250% durante 10 segundos. Saltos fenotípicos inducidos.',
    });
  }

  private constructor() {
    this.diffusionGrid = new FickDiffusionGrid(
      BiocyberneticHabitatEngine.ARENA_DIAMETER_METERS,
      BiocyberneticHabitatEngine.ARENA_DIAMETER_METERS,
      64
    );
    this.meshBridge = HabitatMeshBridgeEngine.getInstance();
    this.metropolisEngine = BiocyberneticMetropolisEngine.getInstance();

    // Iniciar con un ecosistema inicial balanceado con TODAS las inteligencias del proyecto
    this.spawnOrganism('DROSOPHILA', -1.5, 0, 0, true);
    this.spawnOrganism('HUMAN_NEOCORTEX', 0.6, -1.8, Math.PI * 0.75, false);
    this.spawnOrganism('GRAVITY_SENTINEL', 0, 0, -Math.PI * 0.5, false);
    this.spawnOrganism('C_ELEGANS', 1.8, -0.8, Math.PI * 0.5, false);
    this.spawnOrganism('ANT', -0.6, 1.6, Math.PI * 0.25, false);
  }

  public static getInstance(): BiocyberneticHabitatEngine {
    if (!this.instance) {
      this.instance = new BiocyberneticHabitatEngine();
    }
    return this.instance;
  }

  /**
   * Inicia el bucle de simulación determinista a 60 Hz desacoplado de la tasa de refresco.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1. Escuchar emergencias cinéticas del operador (KineticStressEngine)
    this.kineticStressUnsub = kineticStress.subscribe((tel) => {
      if (tel.level === 'CRITICAL_SHOCK' || tel.isManDownActive) {
        this.diffusionGrid.injectChemical(
          BiocyberneticHabitatEngine.ARENA_RADIUS_METERS,
          BiocyberneticHabitatEngine.ARENA_RADIUS_METERS,
          25.0,
          'ALARM_PHEROMONE'
        );
      }
    });

    // 2. Iniciar enlace de migración P2P y orquestador del conectoma
    this.meshBridge.start();
    this.meshBridgeUnsub = this.meshBridge.onOrganismImmigrated((immigrant) => {
      this.handleIncomingImmigrant(immigrant);
    });
    connectomeBioBridge.startConnectome();

    // 3. Lanzar bucle con acumulador temporal protegido contra Spiral of Death
    const loop = (currentTimestamp: number) => {
      if (!this.isRunning) return;

      const frameDeltaSec = Math.min(0.1, (currentTimestamp - this.lastFrameTimestamp) / 1000.0);
      this.lastFrameTimestamp = currentTimestamp;
      if (this.timeScale > 0) {
        this.accumulator += frameDeltaSec * this.timeScale;
      }

      const maxSteps = Math.max(BiocyberneticHabitatEngine.MAX_PHYSICS_SUB_STEPS, Math.ceil(this.timeScale * 4));
      let subSteps = 0;
      while (
        this.accumulator >= BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC &&
        subSteps < maxSteps
      ) {
        this.physicsTick(BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC);
        this.accumulator -= BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC;
        subSteps++;
      }

      // Romper espiral de muerte si el hardware entra en lag severo
      if (this.accumulator >= BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC) {
        this.accumulator = 0;
      }

      // Throttling de telemetría a 10 Hz (evita re-renders y reducciones de 4096 celdas a 60 FPS)
      if (this.simTimeSec - this.lastTelemetryTimeSec >= BiocyberneticHabitatEngine.TELEMETRY_INTERVAL_SEC) {
        this.lastTelemetryTimeSec = this.simTimeSec;
        this.notifyTelemetry();
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animFrameId = requestAnimationFrame(loop);
      } else {
        this.animFrameId = setTimeout(() => loop(Date.now()), 16);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(loop);
    } else {
      this.animFrameId = setTimeout(() => loop(Date.now()), 16);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId);
      }
      this.animFrameId = null;
    }

    if (this.kineticStressUnsub) {
      this.kineticStressUnsub();
      this.kineticStressUnsub = null;
    }
    if (this.meshBridgeUnsub) {
      this.meshBridgeUnsub();
      this.meshBridgeUnsub = null;
    }
    this.meshBridge.stop();
    connectomeBioBridge.stopConnectome();
  }

  /**
   * Crea e introduce un nuevo organismo en el hábitat.
   */
  public spawnOrganism(
    species: OrganismSpecies = 'DROSOPHILA',
    x: number = 0,
    y: number = 0,
    headingRad: number = 0,
    isLeader: boolean = false,
    parentGenome?: OrganismGenome,
    parentId?: string
  ): HabitatOrganism {
    const id = `org-${species.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let genome: OrganismGenome;
    if (parentGenome) {
      const { childGenome, mutationHighlights } = inheritGenomeWithMutation(
        parentGenome,
        parentId || 'parent',
        this.simTimeSec,
        this.environmentalStressMultiplier
      );
      genome = childGenome;
      this.totalBirths++;
      if (genome.generation > this.maxGenerationReached) {
        this.maxGenerationReached = genome.generation;
      }
      this.addEvolutionChronicle({
        type: mutationHighlights.length > 0 ? 'MUTATION_BREAKTHROUGH' : 'MITOSIS',
        species,
        organismId: id,
        generation: genome.generation,
        lineageId: genome.lineageId,
        headline: mutationHighlights.length > 0
          ? `🧬 Mitosis con Mutación (G${genome.generation})`
          : `✨ Mitosis Exitosa (G${genome.generation})`,
        detail: mutationHighlights.length > 0
          ? `${species} (${id.slice(-6)}): ${mutationHighlights.join(', ')}`
          : `${species} (${id.slice(-6)}) heredó linaje ${genome.lineageId}`,
      });
    } else {
      genome = createInitialGenome(species, this.lineageCounter++);
      this.totalBirths++;
      this.addEvolutionChronicle({
        type: 'BIRTH',
        species,
        organismId: id,
        generation: 1,
        lineageId: genome.lineageId,
        headline: `🌱 Nacimiento Fundador (G1)`,
        detail: `Linaje ${genome.lineageId} establecido en el hábitat.`,
      });
    }

    const wormJoints = [];
    for (let j = 0; j < 10; j++) {
      wormJoints.push({
        x: x - Math.cos(headingRad) * (j * 0.07),
        y: y - Math.sin(headingRad) * (j * 0.07),
      });
    }

    let defaultThought = 'Observando el biodomo...';
    let defaultMood: OrganismMood = 'CURIOUS';
    let personality = 'Explorador';
    let initialAltitude = 0;

    if (species === 'DROSOPHILA') {
      defaultThought = 'Buscando néctar dulce con marcha trípode 🍓';
      defaultMood = 'HUNGRY';
      personality = 'Ágil y Glotona';
    } else if (species === 'HUMAN_NEOCORTEX') {
      defaultThought = 'Cartografiando celdas entorrinales y minimizando energía libre 🧠';
      defaultMood = 'CURIOUS';
      personality = 'Estratega Epistémico';
    } else if (species === 'GRAVITY_SENTINEL') {
      defaultThought = 'Escaneo de perímetro: Malla cuántica segura al 100% 🛸';
      defaultMood = 'VIGILANT';
      personality = 'Guardián Autónomo';
      initialAltitude = 1.8;
    } else if (species === 'C_ELEGANS') {
      defaultThought = 'Ondulación quimiosensorial plácida con 302 neuronas 🐛';
      defaultMood = 'ZEN';
      personality = 'Explorador Zen';
    } else if (species === 'ANT') {
      defaultThought = '¡Por la colonia! Rastreando senderos de feromonas 🐜';
      defaultMood = 'ENERGETIC';
      personality = 'Obrera Leal';
    }

    // ── Asignación Atómica de Identidad Cívica y Domicilio Urbano (L9) ──
    const caste = this.metropolisEngine.determineCasteFromGenome(genome, species);
    const civicIdentity = this.metropolisEngine.assignCitizenCivicIdentity(species, caste, id);
    const homeCell = this.metropolisEngine.assignCitizenCell(id, civicIdentity.homeId);

    const org: HabitatOrganism = {
      id,
      species,
      x,
      y,
      z: initialAltitude,
      headingRad,
      speedMps: 0,
      generation: genome.generation,
      genome,
      ageSec: 0,
      atpCollectedTotal: 0,
      offspringCount: 0,
      trophallaxisTimerSec: 0,
      metabolism: new BiocyberneticMetabolismEngine(1.0),
      eye: new OmmatidialCompoundEye(),
      plasticity: new PersistentSynapticPlasticityEngine(),
      isLeader: isLeader || !this.getLeader(),
      legAnglesDeg: new Array(18).fill(90),
      sinusoidalPhase: Math.random() * Math.PI * 2,
      wormJoints,
      lastConcentration: 0,
      pirouetteTimerSec: 0,
      isCarryingFood: false,
      satietyTimerSec: 0,
      isDecomposing: false,
      decompositionRemainingSec: 25.0,
      behaviorState: 'FORAGING',
      wingFlapPhase: 0,
      nestExitCooldownSec: 0,
      currentThought: defaultThought,
      thoughtTimerSec: 2.0 + Math.random() * 3.0,
      mood: defaultMood,
      personality,
      altitudeMeters: initialAltitude,
      laserChaseTarget: null,
      acrobaticTimerSec: 0,
      pettedTimerSec: 0,
      wisdomLevel: 5.0,
      curiosityScore: 0.85,
      isDreaming: false,
      sleepReplayTicks: 0,
      caste,
      biopolymerCarried: 0,
      civicJob: civicIdentity.job,
      homeStructureId: civicIdentity.homeId,
      workplaceStructureId: civicIdentity.workplaceId,
      homeCellId: homeCell?.id,
      dailySchedulePhase: 'WORK_DUTY',
      flightAltitudeTargetMeters: species === 'DROSOPHILA' ? 1.8 : initialAltitude,
      civicActionDescription: 'Iniciando turno cívico en la metrópolis',
      lifeStage: 'ADULT_IMAGO',
      stageProgressPercent: 100,
      microAtpWallet: 15.0,
      airCorridorTargetNodeId: null,
      bdiBeliefSummary: 'Topografía urbana reconocida; sinapsis al 100%',
      bdiDesire: 'Labor cívica y supervivencia metabólica',
      bdiIntention: 'Incorporación al sistema de transporte cívico',
    };

    this.organisms.set(id, org);
    return org;
  }

  /**
   * Tick biofísico discreto a 60 Hz exactos.
   */
  public physicsTick(dt: number): void {
    this.simTimeSec += dt;
    this.metropolisEngine.tick(dt);

    // 1. Difusión de Fick continua (PDE) con viento leve advectivo
    const wind = { vx: 0.06 * Math.sin(this.simTimeSec * 0.25), vy: 0.03 * Math.cos(this.simTimeSec * 0.35) };
    this.diffusionGrid.step(dt, wind);

    // 2. Actualizar proyectores de sombras (Looming threats)
    for (let i = this.shadows.length - 1; i >= 0; i--) {
      const sh = this.shadows[i];
      sh.durationSec -= dt;
      sh.radiusMeters += sh.velocityMps * dt;
      if (sh.durationSec <= 0) {
        this.shadows.splice(i, 1);
      }
    }

    // 3. Actualizar ondas de choque / Ráfagas de aire (Air Puff Waves)
    for (let i = this.airPuffWaves.length - 1; i >= 0; i--) {
      const wave = this.airPuffWaves[i];
      wave.durationSec -= dt;
      wave.radiusMeters += 4.5 * dt;
      if (wave.durationSec <= 0 || wave.radiusMeters >= wave.maxRadiusMeters) {
        this.airPuffWaves.splice(i, 1);
      }
    }

    // 3.1 Actualización del Gran Torneo de Glucosa (Sugar Grand Prix)
    if (this.sugarRace.isActive) {
      this.sugarRace.timeRemainingSec -= dt;
      const centerOffset = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
      if (!this.sugarRace.winnerSpecies) {
        // Inyectar faro continuo de glucosa dorada en la posición objetivo
        const goalGridX = this.sugarRace.targetX + centerOffset;
        const goalGridY = this.sugarRace.targetY + centerOffset;
        this.diffusionGrid.injectChemical(goalGridX, goalGridY, 4.0 * dt, 'GLUCOSE');

        // Evaluar victoria por proximidad al Mega-Cristal (< 0.75m)
        for (const org of this.organisms.values()) {
          if (org.isDecomposing) continue;
          const distToGoal = Math.hypot(org.x - this.sugarRace.targetX, org.y - this.sugarRace.targetY);
          if (distToGoal < 0.75) {
            this.sugarRace.winnerSpecies = org.species;
            const winnerTitle = this.getSpeciesDisplayName(org.species);
            this.sugarRace.winnerName = winnerTitle;
            this.sugarRace.announcement = `🏆 ¡${winnerTitle.toUpperCase()} HA ALCANZADO EL MEGA-CRISTAL! Victoria para su arquitectura.`;
            org.metabolism.ingestNutrient(1.0);
            org.plasticity.injectDopamine(25.0);
            org.mood = 'COMPETITIVE';
            org.currentThought = '¡VICTORIA! ¡Conquisté el Mega-Cristal dorado para mi especie! 🏆✨';
            TacticalAudioEngine.playRogerBeep();
            TacticalAudioEngine.playDopamineChime();
            break;
          }
        }
      }

      if (this.sugarRace.timeRemainingSec <= 0) {
        this.sugarRace.isActive = false;
        if (!this.sugarRace.winnerSpecies) {
          this.sugarRace.announcement = '🏁 El Gran Torneo concluyó por tiempo límite. Empate técnico.';
        }
      }
    }

    // 3.2 Temporizador de Puntero Láser Juguetón
    if (this.laserChaseTimerSec > 0) {
      this.laserChaseTimerSec -= dt;
      if (this.laserChaseTimerSec <= 0) {
        this.laserChaseGlobalTarget = null;
        for (const org of this.organisms.values()) {
          org.laserChaseTarget = null;
        }
      }
    }

    // 3.3 Simulación de Partidas Autónomas de Ajedrez Táctico In-Silico
    const chessMove = autonomousHabitatChess.update(dt);
    if (chessMove && autonomousHabitatChess.lastThought) {
      this.recentThoughts.unshift(autonomousHabitatChess.lastThought);
      if (this.recentThoughts.length > 8) {
        this.recentThoughts.pop();
      }
      TacticalAudioEngine.playTap();
    }

    // 3.4 Paraíso Biocibernético & Aprendizaje Permanente L9
    biocyberneticEdenParadise.update(dt, this.diffusionGrid);
    const circadian = biocyberneticEdenParadise.getCircadianState();

    let sanctuaryOrganismsCount = 0;
    let dreamingOrganismsCount = 0;

    for (const org of this.organisms.values()) {
      if (org.isDecomposing) continue;

      const inSanctuary = biocyberneticEdenParadise.isInTreeOfLifeSanctuary(org.x, org.y);
      if (inSanctuary) {
        sanctuaryOrganismsCount++;
        org.metabolism.ingestNutrient(0.06 * dt);
        org.satietyTimerSec = Math.min(10.0, org.satietyTimerSec + dt * 2.0);

        if (!circadian.isDaytime || org.speedMps < 0.15) {
          org.isDreaming = true;
          dreamingOrganismsCount++;
          org.mood = 'TRANSCENDENCE';
          org.sleepReplayTicks += dt;
        } else {
          org.mood = 'SERENITY';
          org.isDreaming = false;
        }

        if (org.thoughtTimerSec <= 0.1 && Math.random() < 0.3) {
          org.currentThought = autonomousLifelongLearning.generateLearningReflection(org.species, org.id);
          org.thoughtTimerSec = 6.0 + Math.random() * 4.0;
        }
      } else {
        const closestSpring = biocyberneticEdenParadise.getClosestSpring(org.x, org.y);
        if (closestSpring && closestSpring.dist <= closestSpring.spring.radiusMeters) {
          org.metabolism.ingestNutrient(0.12 * dt);
          org.plasticity.injectDopamine(1.8 * dt);
          org.mood = 'SERENITY';
          org.isDreaming = false;
        } else {
          org.isDreaming = false;
        }
      }
    }

    biocyberneticEdenParadise.setSanctuaryOrganismsCount(sanctuaryOrganismsCount);
    autonomousLifelongLearning.update(dt, !circadian.isDaytime || sanctuaryOrganismsCount > 0, dreamingOrganismsCount);

    // 3.5 Regeneración Ecológica Natural de Néctar (Sustentabilidad A-Life)
    this.autoSporeCooldownSec -= dt;
    if (this.autoSporeCooldownSec <= 0) {
      this.autoSporeCooldownSec = 5.0;
      const centerOffset = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
      const springs = [
        { x: -10.0, y: -10.0 },
        { x: 10.0, y: -10.0 },
        { x: -10.0, y: 10.0 },
        { x: 10.0, y: 10.0 },
        { x: 0, y: 16.0 },
        { x: 0, y: -16.0 },
        { x: 16.0, y: 0 },
        { x: -16.0, y: 0 },
      ];
      for (const sp of springs) {
        this.diffusionGrid.injectChemical(sp.x + centerOffset, sp.y + centerOffset, 3.5, 'GLUCOSE');
      }
    }

    // 4. Actualizar organismos (asegurar liderazgo activo continuo)
    const centerOffset = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
    this.ensureLeaderSuccession();

    for (const [id, org] of this.organisms.entries()) {
      org.ageSec += dt;

      // 4.0 Gestión de Biodegradación de Organismos Fenececidos
      if (org.isDecomposing) {
        org.decompositionRemainingSec -= dt;
        const gridX = org.x + centerOffset;
        const gridY = org.y + centerOffset;
        // La biomasa se disuelve lentamente en la grilla enriqueciendo el sustrato
        this.diffusionGrid.injectChemical(gridX, gridY, 0.05 * dt, 'GLUCOSE');
        if (org.decompositionRemainingSec <= 0) {
          this.metropolisEngine.recycleDecomposedCorpse(org.x, org.y, 4.0);
          if (org.homeCellId) {
            this.metropolisEngine.setCellOccupancy(org.homeCellId, false, false);
          }
          this.organisms.delete(id);
          this.ensureLeaderSuccession();
        }
        continue;
      }

      // Senescencia celular biológica (límite de longevidad)
      if (org.ageSec >= org.genome.longevityGene && !org.isDecomposing) {
        org.isDecomposing = true;
        org.isLeader = false;
        org.behaviorState = 'SENESCENT_DECAY';
        this.totalDeaths++;
        this.ensureLeaderSuccession();
        this.addEvolutionChronicle({
          type: 'SENESCENCE',
          species: org.species,
          organismId: org.id,
          generation: org.genome.generation,
          lineageId: org.genome.lineageId,
          headline: `🍂 Senescencia Celular (G${org.genome.generation})`,
          detail: `${org.species} (${org.id.slice(-6)}) completó su ciclo tras ${Math.round(org.ageSec)}s (Fitness: ${computeFitnessScore(org.genome, org.ageSec, org.atpCollectedTotal, org.offspringCount)}).`,
        });
        continue;
      }

      if (org.metabolism.getTelemetry().isDead && !org.isDecomposing) {
        org.isDecomposing = true;
        org.isLeader = false;
        org.behaviorState = 'DECAYING_BIOMASS';
        this.totalDeaths++;
        this.ensureLeaderSuccession();
        this.addEvolutionChronicle({
          type: 'STARVATION',
          species: org.species,
          organismId: org.id,
          generation: org.genome.generation,
          lineageId: org.genome.lineageId,
          headline: `💀 Muerte por Inanición (G${org.genome.generation})`,
          detail: `${org.species} (${org.id.slice(-6)}) agotó su ATP tras ${Math.round(org.ageSec)}s. Su biomasa fertiliza el suelo.`,
        });
        continue;
      }

      // 4.0.0 Trofalaxis Social (Intercambio A-Life de Nutrientes entre Organismos Afines)
      if (org.trophallaxisTimerSec > 0) {
        org.trophallaxisTimerSec -= dt;
      } else if (org.genome.cooperationGene > 0.45 && org.metabolism.getTelemetry().atpLevel > 0.65) {
        const friend = this.getNearestOrganismOfSpecies(org.x, org.y, org.species, org.id);
        if (friend && friend.dist < 0.8 && friend.org.metabolism.getTelemetry().atpLevel < 0.45 && !friend.org.isDecomposing) {
          org.trophallaxisTimerSec = 8.0;
          friend.org.trophallaxisTimerSec = 8.0;
          org.behaviorState = 'SOCIAL_TROPHALLAXIS';
          friend.org.behaviorState = 'SOCIAL_TROPHALLAXIS';
          org.metabolism.expendAtp(0.08);
          friend.org.metabolism.ingestNutrient(0.08 * friend.org.genome.metabolicEfficiencyGene);
          org.plasticity.injectDopamine(1.5);
          friend.org.plasticity.injectDopamine(1.5);
          this.addEvolutionChronicle({
            type: 'TROPHALLAXIS',
            species: org.species,
            organismId: org.id,
            generation: org.genome.generation,
            lineageId: org.genome.lineageId,
            headline: `🤝 Trofalaxis Social (${org.species})`,
            detail: `${org.id.slice(-6)} [G${org.generation}] compartió nutrientes con ${friend.org.id.slice(-6)} [G${friend.org.generation}].`,
          });
        }
      }

      // 4.0.1 Gestión de Acrobacias y Caricias Afectivas
      if (org.acrobaticTimerSec > 0) {
        org.acrobaticTimerSec -= dt;
      }
      if (org.pettedTimerSec > 0) {
        org.pettedTimerSec -= dt;
      }

      // 4.0.2 Actualización Dinámica de Pensamientos Cognitivos Vivos
      org.thoughtTimerSec -= dt;
      if (org.thoughtTimerSec <= 0) {
        this.generateLivingThought(org);
        org.thoughtTimerSec = 3.5 + Math.random() * 3.5;
      }

      const gridX = org.x + centerOffset;
      const gridY = org.y + centerOffset;

      // 4.1 Reacción a Ondas de Aire / Sonda Mecanosensorial (Air Puff Poke)
      for (const wave of this.airPuffWaves) {
        const distToWave = Math.hypot(org.x - wave.x, org.y - wave.y);
        if (Math.abs(distToWave - wave.radiusMeters) < 0.6) {
          // Empuje radial expansivo inmediato
          const pushAngle = Math.atan2(org.y - wave.y, org.x - wave.x);
          org.headingRad = pushAngle + (Math.random() - 0.5) * 0.4;
          org.speedMps = Math.min(4.0, org.speedMps + 2.5 * wave.strength);
          org.behaviorState = 'AIR_PUFF_STARTLE';
          org.plasticity.injectOctopamine(0.3 * wave.strength);
        }
      }

      // 4.2 Lógica Especializada por Especie e Interacciones Ecológicas
      let turnRateRadPerSec = 0;
      let targetSpeed = 0.8;

      if (this.sugarRace.isActive && org.species !== 'GRAVITY_SENTINEL') {
        // En el Gran Torneo, todas las inteligencias terrestres se apresuran competitivamente a la meta
        const dx = this.sugarRace.targetX - org.x;
        const dy = this.sugarRace.targetY - org.y;
        const targetAngle = Math.atan2(dy, dx);
        const diff = shortestAngleDiff(targetAngle, org.headingRad);
        turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 4.5);
        targetSpeed = 1.85 * org.metabolism.getLocomotionFactor();
        org.behaviorState = 'RACE_COMPETITIVE_SPRINT';
      } else if (org.laserChaseTarget && org.species !== 'GRAVITY_SENTINEL') {
        // Persecución juguetona del puntero láser
        const dx = org.laserChaseTarget.x - org.x;
        const dy = org.laserChaseTarget.y - org.y;
        const targetAngle = Math.atan2(dy, dx);
        const diff = shortestAngleDiff(targetAngle, org.headingRad);
        turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 5.0);
        targetSpeed = 1.6 * org.metabolism.getLocomotionFactor();
        org.behaviorState = 'PLAYFUL_LASER_CHASE';
      } else if (org.acrobaticTimerSec > 0) {
        turnRateRadPerSec = 16.0; // Giro acrobático vertiginoso 360°
        targetSpeed = 2.2;
        org.behaviorState = 'ACROBATIC_BARREL_ROLL';
      } else if (org.species === 'DROSOPHILA') {
        // ── DROSOPHILA MELANOGASTER: Omatidios, Tripod Gait & STDP Hebbiano ──
        const antennalSample = this.diffusionGrid.sampleAntennaPair(
          gridX,
          gridY,
          org.headingRad,
          0.08,
          'GLUCOSE'
        );
        const alarmSample = this.diffusionGrid.sample(gridX, gridY, 'ALARM_PHEROMONE');

        // 1. Quimiotaxis / Alimentación de glucosa
        const isNearGlucose = antennalSample.meanConcentration > 0.04;
        if (isNearGlucose) {
          const ingested = Math.min(antennalSample.meanConcentration * 0.4, 0.2 * dt);
          org.metabolism.ingestNutrient(ingested);
          org.plasticity.injectDopamine(ingested * 5.0);
          if (org.behaviorState !== 'FEEDING_GLUCOSE') {
            TacticalAudioEngine.playDopamineChime();
          }
          org.behaviorState = 'FEEDING_GLUCOSE';
        } else {
          org.behaviorState = 'FORAGING_WALK';
        }

        // 2. Detección de depredadores (Formicidae / Hormiga en aproximación)
        const nearestAnt = this.getNearestOrganismOfSpecies(org.x, org.y, 'ANT', org.id);
        const distToAnt = nearestAnt ? nearestAnt.dist : 999.0;

        // 3. Visión omatidial de sombras y amenazas compuestas
        const eyeShadows = this.shadows.map(s => ({
          x: s.x - org.x,
          y: 0,
          z: s.y - org.y,
          radiusMeters: s.radiusMeters,
          velocityMps: s.velocityMps,
        }));
        org.eye.step(dt, 0.8, eyeShadows);

        const nearestShadowDist = this.getNearestShadowDistance(org.x, org.y);
        const nearestAirPuff = this.getNearestAirPuffIntensity(org.x, org.y);
        // Si hay una hormiga acechando, el sistema visual la integra como amenaza looming
        const effectiveLoomingDist = Math.min(nearestShadowDist, distToAnt);

        const isDrivenByConnectome = org.isLeader && connectomeBioBridge.isConnectomeActive();

        if (isDrivenByConnectome) {
          // Lazo Sensoriomotor Cerrado: Estímulos Físicos Reales → Cerebro MaleCNS
          const threatAngle = nearestAnt ? Math.atan2(nearestAnt.org.y - org.y, nearestAnt.org.x - org.x) : undefined;
          connectomeBioBridge.injectSensoryStimuli(
            org,
            antennalSample.meanConcentration,
            alarmSample,
            effectiveLoomingDist,
            nearestAirPuff,
            antennalSample.delta,
            threatAngle
          );
          // Decisiones Motoras del Cerebro (Compass E-PG, CPG, Giant Fiber) → Organismo Físico
          connectomeBioBridge.applyMotorCommands(org, isNearGlucose);
        } else {
          // Hebbian STDP y navegación interna autónoma
          const activeKc = [4, 12, 19, 28];
          if (antennalSample.meanConcentration > 0.02) org.plasticity.activateKcPattern(activeKc);
          if (alarmSample > 0.1) org.plasticity.injectOctopamine(alarmSample * 2.0);
          org.plasticity.step(dt);

          const valence = org.plasticity.evaluateValence(activeKc);
          if (valence >= 0) {
            turnRateRadPerSec = antennalSample.delta * 4.5 * (1.0 + valence);
          } else {
            turnRateRadPerSec = -antennalSample.delta * 4.5;
          }

          if (alarmSample > 0.05) turnRateRadPerSec += (Math.random() - 0.5) * 6.0;

          const eyeTel = org.eye.getTelemetry();
          turnRateRadPerSec += eyeTel.horizontalOpticalFlow * 0.2;

          // INTERACCIÓN ECOLÓGICA 1: Evasión refleja ante depredador Formicidae
          if (distToAnt < 0.75 && nearestAnt) {
            // Reflejo Giant Fiber de escape ante ataque de mandíbulas
            const escapeAngle = Math.atan2(org.y - nearestAnt.org.y, org.x - nearestAnt.org.x);
            org.headingRad = normalizeAngle(escapeAngle + (Math.random() - 0.5) * 0.4);
            org.speedMps = 3.6;
            targetSpeed = 3.6;
            if (org.behaviorState !== 'EVADING_PREDATOR_ANT') {
              TacticalAudioEngine.playReflexEscape();
            }
            org.behaviorState = 'EVADING_PREDATOR_ANT';
            org.plasticity.injectOctopamine(0.4);
          } else if (distToAnt < 1.15 && nearestAnt) {
            // Alerta visual de aproximación de hormiga
            const awayAngle = Math.atan2(org.y - nearestAnt.org.y, org.x - nearestAnt.org.x);
            const diff = shortestAngleDiff(awayAngle, org.headingRad);
            turnRateRadPerSec += Math.sign(diff) * 3.4;
            targetSpeed = 1.35;
            if (org.behaviorState === 'FORAGING_WALK') org.behaviorState = 'ALERT_PREDATOR_APPROACH';
          } else if (eyeTel.giantFiberTriggered) {
            org.speedMps = 3.8;
            turnRateRadPerSec += Math.PI * 0.8;
            if (org.behaviorState !== 'GIANT_FIBER_ESCAPE') {
              TacticalAudioEngine.playReflexEscape();
            }
            org.behaviorState = 'GIANT_FIBER_ESCAPE';
          } else {
            // INTERACCIÓN ECOLÓGICA 2: Distancia social conespecífica (Mosca ↔ Mosca)
            const nearestFly = this.getNearestOrganismOfSpecies(org.x, org.y, 'DROSOPHILA', org.id);
            if (nearestFly && nearestFly.dist < 0.65) {
              const repulseAngle = Math.atan2(org.y - nearestFly.org.y, org.x - nearestFly.org.x);
              const diff = shortestAngleDiff(repulseAngle, org.headingRad);
              turnRateRadPerSec += Math.sign(diff) * 2.6;
              if (org.behaviorState === 'FORAGING_WALK') org.behaviorState = 'TERRITORIAL_SPACING';
            }

            // ── ARQUITECTURA COGNITIVA BDI & URBANISMO DE ALTA PRECISIÓN (L9) ──
            const circadian = biocyberneticEdenParadise.getCircadianState();
            const atpLevel = org.metabolism.getTelemetry().atpLevel;

            // 1. BELIEFS (Creencias sobre el entorno y su propio estado)
            if (!org.homeCellId) {
              const cell = this.metropolisEngine.assignCitizenCell(org.id, org.homeStructureId || 'tower-nexus') ||
                           this.metropolisEngine.assignCitizenCell(org.id, 'tower-helix') ||
                           this.metropolisEngine.assignCitizenCell(org.id, 'tower-apex');
              if (cell) org.homeCellId = cell.id;
            }

            org.bdiBeliefSummary = `Ciclo: ${circadian.isDaytime ? 'Día' : 'Noche'} | ATP: ${(atpLevel * 100).toFixed(0)}% | Celda: ${org.homeCellId || 'Asignada'}`;

            // 2. DESIRES (Jerarquía de deseos y prioridades Maslow-A-Life)
            if (atpLevel < 0.20) {
              org.dailySchedulePhase = 'COMMUTE_TO_BREAKFAST';
              org.bdiDesire = 'SUPERVIVENCIA_NUTRICIONAL_URGENTE';
            } else if (!circadian.isDaytime) {
              org.dailySchedulePhase = 'SLEEP_AT_HOME';
              org.bdiDesire = 'REPOSO_CIRCADIANO_RESIDENCIAL';
            } else if (atpLevel < 0.60) {
              org.dailySchedulePhase = 'COMMUTE_TO_BREAKFAST';
              org.bdiDesire = 'DESAYUNO_COMUNITARIO_EN_SILO';
            } else {
              org.dailySchedulePhase = 'WORK_DUTY';
              org.bdiDesire = `LABOR_CIVICA_${org.civicJob || 'GENERAL'}`;
            }

            // 3. INTENTIONS & WAYPOINT MAPPING (Plan de acción espacial 3D)
            let targetX = 0;
            let targetY = 0;
            let targetAltitude = 0.1;
            let goalDescription = '';

            if (org.dailySchedulePhase === 'SLEEP_AT_HOME') {
              const home = this.metropolisEngine.getStructure(org.homeStructureId || 'tower-nexus') ||
                           this.metropolisEngine.getNearestStructureOfType(org.x, org.y, 'BIO_TOWER_DWELLING');
              if (home) {
                targetX = home.x;
                targetY = home.y;
                targetAltitude = home.heightMeters ? home.heightMeters * 0.72 : 4.5;
                goalDescription = `Regresando a descansar en ${home.name} [Piso residencial] 🏠`;
              }
            } else if (org.dailySchedulePhase === 'COMMUTE_TO_BREAKFAST') {
              const silo = this.metropolisEngine.getStructure('silo-alpha') ||
                           this.metropolisEngine.getNearestStructureOfType(org.x, org.y, 'CENTRAL_SILO');
              if (silo) {
                targetX = silo.x;
                targetY = silo.y;
                targetAltitude = 0.6;
                goalDescription = `Volando al ${silo.name} a desayunar glucosa 🍓`;
              }
            } else {
              // Turno laboral según la profesión cívica
              if (org.civicJob === 'AERIAL_COURIER') {
                if (org.biopolymerCarried > 0) {
                  const buildSite = this.metropolisEngine.getStructuresByType('BIO_TOWER_DWELLING').find(s => s.constructionProgress < 1.0) ||
                                    this.metropolisEngine.getStructure('tower-apex') ||
                                    this.metropolisEngine.getStructure('tower-helix') ||
                                    this.metropolisEngine.getStructure('tower-nexus');
                  if (buildSite) {
                    targetX = buildSite.x;
                    targetY = buildSite.y;
                    targetAltitude = 2.4;
                    goalDescription = `Mensajería aérea: transportando biopolímeros a ${buildSite.name} 📦`;
                  }
                } else {
                  const factory = this.metropolisEngine.getStructure('bio-factory-alpha') ||
                                  this.metropolisEngine.getStructure('silo-alpha');
                  if (factory) {
                    targetX = factory.x;
                    targetY = factory.y;
                    targetAltitude = 1.2;
                    goalDescription = `Recogiendo lote de biopolímero en ${factory.name} 🏭`;
                  }
                }
              } else if (org.civicJob === 'RESEARCH_SCHOLAR') {
                const lab = this.metropolisEngine.getStructure('research-connectome') ||
                            this.metropolisEngine.getNearestStructureOfType(org.x, org.y, 'RESEARCH_CONNECTOME');
                if (lab) {
                  targetX = lab.x;
                  targetY = lab.y;
                  targetAltitude = 1.5;
                  goalDescription = `Investigando sinapsis cuánticas en el Laboratorio Conectoma 🔬`;
                }
              } else {
                // NECTAR_FORAGER / CIVIC_CITIZEN
                const springs = biocyberneticEdenParadise.nectarSprings;
                if (springs.length > 0) {
                  const targetSpring = springs[Math.abs(Math.floor(org.ageSec * 0.1)) % springs.length];
                  targetX = targetSpring.x;
                  targetY = targetSpring.y;
                  targetAltitude = 0.4;
                  goalDescription = `Cosechando néctar en ${targetSpring.name} 🍯`;
                }
              }
            }

            org.civicTargetX = targetX;
            org.civicTargetY = targetY;
            org.civicActionDescription = goalDescription;
            org.bdiIntention = `Vuelo hacia ${goalDescription}`;

            const distToCivicTarget = Math.hypot(targetX - org.x, targetY - org.y);

            if (distToCivicTarget > 0.85) {
              // 4. VUELO AÉREO ACTIVO EN RED DE CORREDORES AÉREOS 3D
              let steerTargetX = targetX;
              let steerTargetY = targetY;
              let cruiseAltitude = 2.4 + Math.sin(this.simTimeSec * 3.5) * 0.3;

              if (distToCivicTarget > 2.2) {
                const corridorWp = this.metropolisEngine.findNearestAirCorridorWaypoint(org.x, org.y, org.altitudeMeters);
                if (corridorWp && Math.hypot(corridorWp.x - org.x, corridorWp.y - org.y) > 0.5) {
                  steerTargetX = corridorWp.x;
                  steerTargetY = corridorWp.y;
                  cruiseAltitude = corridorWp.altitude;
                  org.airCorridorTargetNodeId = corridorWp.id;
                }
              }

              const toTargetAngle = Math.atan2(steerTargetY - org.y, steerTargetX - org.x);
              const angleDiff = shortestAngleDiff(toTargetAngle, org.headingRad);
              turnRateRadPerSec = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 4.5);
              targetSpeed = 2.8 * org.metabolism.getLocomotionFactor();
              org.flightAltitudeTargetMeters = cruiseAltitude;
              org.behaviorState = 'URBAN_AERIAL_TRANSIT';

              // Si estaba durmiendo y ahora vuela, liberar estado de sueño en celda
              if (org.homeCellId) {
                this.metropolisEngine.setCellOccupancy(org.homeCellId, true, false);
              }
              org.isDreaming = false;
            } else {
              // 5. LLEGADA Y OPERACIONES LOCALES (Aterrizaje, Descanso o Trabajo)
              org.airCorridorTargetNodeId = null;

              if (org.dailySchedulePhase === 'SLEEP_AT_HOME') {
                org.flightAltitudeTargetMeters = targetAltitude;
                targetSpeed = 0.05;
                org.speedMps = 0.05;
                org.behaviorState = 'SLEEPING_AT_HOME';
                org.isDreaming = true;
                org.mood = 'DREAMING';
                org.metabolism.ingestNutrient(0.08 * dt);
                if (org.homeCellId) {
                  this.metropolisEngine.setCellOccupancy(org.homeCellId, true, true);
                }
                org.currentThought = 'Reposo celular en torre residencial; sincronizando memorias nocturnas 💤🏠';
              } else if (org.dailySchedulePhase === 'COMMUTE_TO_BREAKFAST') {
                org.flightAltitudeTargetMeters = 0.3;
                targetSpeed = 0.1;
                org.speedMps = 0.1;
                org.behaviorState = 'BREAKFAST_FEEDING';
                org.metabolism.ingestNutrient(0.16 * dt);
                org.plasticity.injectDopamine(2.5 * dt);
                if (org.homeCellId) {
                  this.metropolisEngine.setCellOccupancy(org.homeCellId, true, false);
                }
                org.currentThought = 'Desayunando glucosa pura en el Silo Central 🍓';
              } else if (org.civicJob === 'AERIAL_COURIER') {
                targetSpeed = 0.15;
                org.flightAltitudeTargetMeters = targetAltitude;
                if (org.biopolymerCarried > 0) {
                  org.biopolymerCarried = 0;
                  this.metropolisEngine.biopolymerStockpile += 0.8;
                  org.microAtpWallet = (org.microAtpWallet || 0) + 2.5;
                  this.metropolisEngine.addCivicEvent(`📦 Mosca #${org.id.slice(-4)} entregó biopolímeros (+2.5 µATP)`);
                  org.currentThought = 'Carga de biopolímeros entregada en obra; recibida recompensa cívica 📦⚡';
                } else {
                  org.biopolymerCarried = 1.0;
                  org.currentThought = 'Lote de biopolímero cargado en bodega. Despegando hacia rascacielos 🛫';
                }
              } else if (org.civicJob === 'RESEARCH_SCHOLAR') {
                targetSpeed = 0.08;
                org.flightAltitudeTargetMeters = 0.5;
                org.behaviorState = 'RESEARCHING_CONNECTOME';
                org.microAtpWallet = (org.microAtpWallet || 0) + 0.15 * dt;
                org.metabolism.ingestNutrient(0.05 * dt);
                org.currentThought = 'Calculando tensores MaleCNS en la plaza del Conectoma Cuántico 🔬🧬';
              } else {
                org.flightAltitudeTargetMeters = 0.1;
                targetSpeed = 0.1;
                org.behaviorState = 'CIVIC_INTERACTION';
                org.metabolism.ingestNutrient(0.04 * dt);
              }
            }
          }
        }
        org.wingFlapPhase = (org.wingFlapPhase + org.speedMps * 35.0 * dt) % (Math.PI * 2);

        // Cinemática 18-DOF para robótica física
        const phase = this.simTimeSec * 4.0 * Math.max(0.2, org.speedMps);
        for (let leg = 0; leg < 6; leg++) {
          const legPhase = phase + (leg % 2 === 0 ? 0 : Math.PI);
          org.legAnglesDeg[leg * 3] = 90 + Math.sin(legPhase) * 25;
          org.legAnglesDeg[leg * 3 + 1] = 90 + Math.cos(legPhase) * 20;
          org.legAnglesDeg[leg * 3 + 2] = 90 - Math.sin(legPhase) * 15;
        }

        if (org.isLeader && this.isActuatorStreaming) {
          hexapodActuatorBridge.dispatchJointAngles(org.legAnglesDeg);
        }

      } else if (org.species === 'C_ELEGANS') {
        // ── CAENORHABDITIS ELEGANS: Ondulación Sinusoidal & Klinokinesis ──
        const currentC = this.diffusionGrid.sample(gridX, gridY, 'GLUCOSE');
        const alarmSample = this.diffusionGrid.sample(gridX, gridY, 'ALARM_PHEROMONE');
        const dC = (currentC - org.lastConcentration) / Math.max(0.001, dt);
        org.lastConcentration = currentC;

        if (currentC > 0.04) {
          const ingested = Math.min(currentC * 0.45, 0.25 * dt);
          org.metabolism.ingestNutrient(ingested);
          org.plasticity.injectDopamine(ingested * 4.0);
          if (org.behaviorState !== 'FEEDING_ON_FOOD') {
            TacticalAudioEngine.playDopamineChime();
          }
        }

        // INTERACCIÓN ECOLÓGICA 3: Reflejo mecanosensorial por contacto de insecto (ALM/PLM)
        const nearestInsect = this.getNearestInsect(org.x, org.y, org.id);

        if (nearestInsect && nearestInsect.dist < 0.45) {
          // Contacto táctil mecánico: retirada retrógrada instantánea y pirueta
          const retreatAngle = Math.atan2(org.y - nearestInsect.org.y, org.x - nearestInsect.org.x);
          org.headingRad = normalizeAngle(retreatAngle + (Math.random() - 0.5) * 0.4);
          org.speedMps = 1.3;
          targetSpeed = 1.3;
          org.pirouetteTimerSec = 0.6;
          org.behaviorState = 'MECHANOSENSORY_TOUCH_REVERSAL';
          org.plasticity.injectOctopamine(0.35);
        } else if (alarmSample > 0.06) {
          // Nocicepción térmica reversa ante calor/alarma
          org.headingRad = normalizeAngle(org.headingRad + Math.PI + (Math.random() - 0.5) * 0.4);
          org.speedMps = 1.5;
          targetSpeed = 1.5;
          org.behaviorState = 'THERMAL_NOCICEPTIVE_REVERSAL';
        } else if (org.pirouetteTimerSec > 0) {
          // En medio de una pirueta (Omega-turn)
          org.pirouetteTimerSec -= dt;
          org.speedMps = 0.25;
          targetSpeed = 0.25;
          org.behaviorState = 'PIROUETTE_OMEGA_TURN';
        } else {
          // Modelo de Klinokinesis de Pierce-Shimomura et al., 1999:
          if (dC > 0.002) {
            // Acercándose al gradiente: supresión de piruetas, avance recto
            targetSpeed = 0.95 * org.metabolism.getLocomotionFactor();
            org.behaviorState = currentC > 0.05 ? 'FEEDING_ON_FOOD' : 'KLINOKINESIS_LONG_RUN';
          } else {
            // Alejándose o gradiente plano: tasa elevada de piruetas
            if (Math.random() < 0.35 * dt) {
              org.pirouetteTimerSec = 0.35 + Math.random() * 0.35;
              const turnAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI * 0.45 + Math.random() * Math.PI * 0.45);
              org.headingRad = normalizeAngle(org.headingRad + turnAngle);
              org.behaviorState = 'PIROUETTE_OMEGA_TURN';
            } else {
              targetSpeed = 0.7 * org.metabolism.getLocomotionFactor();
              org.behaviorState = 'KLINOKINESIS_SEARCH';
            }
          }
        }

        // Cinemática de onda sinusoidal que viaja por la columna de 10 nodos
        org.sinusoidalPhase += Math.max(0.4, org.speedMps) * 6.5 * dt;
        org.wormJoints[0] = { x: org.x, y: org.y };
        const segLen = 0.07;
        for (let j = 1; j < 10; j++) {
          const prev = org.wormJoints[j - 1];
          const perpAngle = org.headingRad + Math.PI * 0.5;
          const waveOffset = Math.sin(org.sinusoidalPhase - j * 0.65) * 0.035;
          const backAngle = org.headingRad + Math.PI;
          org.wormJoints[j] = {
            x: prev.x + Math.cos(backAngle) * segLen + Math.cos(perpAngle) * waveOffset,
            y: prev.y + Math.sin(backAngle) * segLen + Math.sin(perpAngle) * waveOffset,
          };
        }

      } else if (org.species === 'ANT') {
        // ── FORMICIDAE (HORMIGA): Estigmergia, Caza de Moscas & Tráfico del Nido ──
        const antennalGlucose = this.diffusionGrid.sampleAntennaPair(gridX, gridY, org.headingRad, 0.06, 'GLUCOSE');
        const antennalTrail = this.diffusionGrid.sampleAntennaPair(gridX, gridY, org.headingRad, 0.06, 'PHEROMONE_TRAIL');

        // Manejo del enfriamiento tras salir del nido (dispersión centrífuga)
        if (org.nestExitCooldownSec > 0) {
          org.nestExitCooldownSec -= dt;
          targetSpeed = 1.25;
          turnRateRadPerSec = (Math.random() - 0.5) * 0.8;
          org.behaviorState = 'UNLOADED_FORAGING_OUTWARD';
        } else if (!org.isCarryingFood) {
          // INTERACCIÓN ECOLÓGICA 4: Comportamiento predatorio / acecho a Drosophila
          const nearestFly = this.getNearestOrganismOfSpecies(org.x, org.y, 'DROSOPHILA', org.id);

          if (nearestFly && nearestFly.dist < 0.95) {
            // Caza activa de presa: orientarse y correr hacia la mosca
            const angleToFly = Math.atan2(nearestFly.org.y - org.y, nearestFly.org.x - org.x);
            const diff = shortestAngleDiff(angleToFly, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 4.5);
            targetSpeed = 1.45;
            org.behaviorState = 'ANT_CHASING_PREY';

            // Si alcanza la mosca (mordisco / choque mandibular)
            if (nearestFly.dist < 0.38) {
              org.behaviorState = 'ANT_BITING_PREY';
              org.metabolism.ingestNutrient(0.08);
              org.plasticity.injectDopamine(1.5);
              // La mosca sale disparada por el reflejo de sobresalto
              nearestFly.org.speedMps = 3.8;
              nearestFly.org.headingRad = normalizeAngle(angleToFly + Math.PI + (Math.random() - 0.5) * 0.4);
              nearestFly.org.behaviorState = 'EVADING_PREDATOR_ANT';
              if (nearestFly.org.isLeader && connectomeBioBridge.isConnectomeActive()) {
                giantFiberReflex.triggerReflex('VISUAL_LOOMING_THREAT');
              }
              TacticalAudioEngine.playReflexEscape();
            }
          } else if (antennalGlucose.meanConcentration > 0.04) {
            // Encuentra alimento: ingesta y cambio a estado de retorno al nido
            org.metabolism.ingestNutrient(0.25 * dt);
            if (!org.isCarryingFood) {
              TacticalAudioEngine.playDopamineChime();
            }
            org.isCarryingFood = true;
            // Gira hacia el nido / centro (0, 0)
            const angleToNest = Math.atan2(-org.y, -org.x);
            org.headingRad = normalizeAngle(angleToNest + (Math.random() - 0.5) * 0.3);
            org.behaviorState = 'RETURNING_TO_NEST';
          } else {
            // Sigue el rastro de feromona estigmérgico si existe
            if (antennalTrail.meanConcentration > 0.005) {
              turnRateRadPerSec = antennalTrail.delta * 4.8;
              org.behaviorState = 'FOLLOWING_STIGMERGIC_TRAIL';
              targetSpeed = 1.35;
            } else {
              turnRateRadPerSec = (Math.random() - 0.5) * 2.5;
              org.behaviorState = 'FORAGING_RANDOM_WALK';
              targetSpeed = 1.0;
            }
          }

          // INTERACCIÓN ECOLÓGICA 5: Evitación mutua entre hormigas (regla de carril derecho)
          const nearestAnt = this.getNearestOrganismOfSpecies(org.x, org.y, 'ANT', org.id);
          if (nearestAnt && nearestAnt.dist < 0.48) {
            turnRateRadPerSec += 1.8;
          }

        } else {
          // Cargando alimento: Deposita feromona de rastro continua en la grilla de Fick
          this.diffusionGrid.injectChemical(gridX, gridY, 1.4 * dt, 'PHEROMONE_TRAIL');
          org.behaviorState = 'DEPOSITING_TRAIL_PHEROMONE';
          targetSpeed = 1.25;

          const angleToNest = Math.atan2(-org.y, -org.x);
          const diff = shortestAngleDiff(angleToNest, org.headingRad);
          turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 3.8);

          // Si llegó al nido (< 0.85 m del centro)
          if (Math.hypot(org.x, org.y) < 0.85) {
            org.isCarryingFood = false;
            org.nestExitCooldownSec = 2.8; // Período de salida sin volver a engancharse al rastro
            // Vector de salida radial hacia afuera del nido
            const outwardAngle = Math.hypot(org.x, org.y) > 0.05
              ? Math.atan2(org.y, org.x) + (Math.random() - 0.5) * 0.8
              : Math.random() * Math.PI * 2;
            org.headingRad = normalizeAngle(outwardAngle);
            org.speedMps = 1.35;
            org.behaviorState = 'UNLOADED_FORAGING_OUTWARD';
            TacticalAudioEngine.playDopamineChime();
          }
        }
      } else if (org.species === 'GRAVITY_SENTINEL') {
        // ── GRAVITY AI SENTINEL: Dron Autónomo de Vigilancia y Comentarista Soberano ──
        org.altitudeMeters = 1.8 + 0.25 * Math.sin(this.simTimeSec * 1.8);
        org.z = org.altitudeMeters;

        if (this.sugarRace.isActive) {
          // Si el Gran Torneo está activo, vuela sobre la meta como árbitro/comentarista
          const dx = this.sugarRace.targetX - org.x;
          const dy = this.sugarRace.targetY - org.y;
          const distToGoal = Math.hypot(dx, dy);
          if (distToGoal > 0.4) {
            const targetAngle = Math.atan2(dy, dx);
            const diff = shortestAngleDiff(targetAngle, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 4.2);
            targetSpeed = 1.8;
          } else {
            targetSpeed = 0.3;
            turnRateRadPerSec = 0.8; // Giro panorámico de observación
          }
          org.behaviorState = 'RACE_REFEREE_OVERWATCH';
        } else if (org.laserChaseTarget) {
          // Persigue el puntero láser juguetonamente
          const dx = org.laserChaseTarget.x - org.x;
          const dy = org.laserChaseTarget.y - org.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.3) {
            const targetAngle = Math.atan2(dy, dx);
            const diff = shortestAngleDiff(targetAngle, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 5.0);
            targetSpeed = 2.2;
          } else {
            targetSpeed = 0.2;
          }
          org.behaviorState = 'LASER_INSPECTION_HOVER';
        } else {
          // Patrulla orbital suave o seguimiento de la mosca líder
          const leader = this.getLeader();
          if (leader && leader.id !== org.id) {
            const dx = leader.x - org.x;
            const dy = leader.y - org.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 2.5) {
              const targetAngle = Math.atan2(dy, dx);
              const diff = shortestAngleDiff(targetAngle, org.headingRad);
              turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 2.5);
              targetSpeed = 1.4;
            } else {
              turnRateRadPerSec = 0.5; // Órbita suave
              targetSpeed = 0.6;
            }
          } else {
            // Patrulla perimétrica
            turnRateRadPerSec = 0.35 + 0.1 * Math.sin(this.simTimeSec * 0.5);
            targetSpeed = 1.0;
          }
          org.behaviorState = 'SENTINEL_PATROL_SCAN';
        }

      } else if (org.species === 'HUMAN_NEOCORTEX') {
        // ── HUMAN NEOCORTEX AVATAR: Navegación Epistémica y Mapeo Entorrinal ──
        org.z = 0;
        const currentC = this.diffusionGrid.sample(gridX, gridY, 'GLUCOSE');
        if (currentC > 0.05) {
          const ingested = Math.min(currentC * 0.3, 0.2 * dt);
          org.metabolism.ingestNutrient(ingested);
        }

        if (this.sugarRace.isActive) {
          // En el Torneo, corre activamente hacia la meta
          const dx = this.sugarRace.targetX - org.x;
          const dy = this.sugarRace.targetY - org.y;
          const distToGoal = Math.hypot(dx, dy);
          if (distToGoal > 0.25) {
            const targetAngle = Math.atan2(dy, dx);
            const diff = shortestAngleDiff(targetAngle, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 4.0);
            targetSpeed = 1.7;
          } else {
            targetSpeed = 0.1;
          }
          org.behaviorState = 'RACE_COMPETITIVE_SPRINT';
        } else if (org.laserChaseTarget) {
          const dx = org.laserChaseTarget.x - org.x;
          const dy = org.laserChaseTarget.y - org.y;
          const targetAngle = Math.atan2(dy, dx);
          const diff = shortestAngleDiff(targetAngle, org.headingRad);
          turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 3.5);
          targetSpeed = 1.4;
          org.behaviorState = 'ACTIVE_INFERENCE_INSPECT';
        } else {
          // Exploración guiada por curiosidad epistémica (minimizar entropía)
          const nearestPeer = this.getNearestOrganismOfSpecies(org.x, org.y, 'DROSOPHILA', org.id);
          if (nearestPeer && nearestPeer.dist > 1.2 && nearestPeer.dist < 3.5) {
            const dx = nearestPeer.org.x - org.x;
            const dy = nearestPeer.org.y - org.y;
            const targetAngle = Math.atan2(dy, dx);
            const diff = shortestAngleDiff(targetAngle, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * 1.5;
            targetSpeed = 0.85;
            org.behaviorState = 'SOCIAL_THEORY_OF_MIND';
          } else {
            turnRateRadPerSec = (Math.random() - 0.5) * 1.2;
            targetSpeed = 0.75;
            org.behaviorState = 'ENTORHINAL_GRID_MAPPING';
          }
        }
      }

      // 4.29 Conducción Táctica según Casta Cívica (Stigmergic Civic Taxis)
      if (org.caste === 'BUILDER') {
        const unfinished = Array.from(this.metropolisEngine.structures.values()).find((s) => s.constructionProgress < 1.0);
        if (unfinished) {
          const dx = unfinished.x - org.x;
          const dy = unfinished.y - org.y;
          const dist = Math.hypot(dx, dy);
          if (dist > unfinished.radiusMeters + 0.3) {
            const targetAngle = Math.atan2(dy, dx);
            const diff = shortestAngleDiff(targetAngle, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 3.8);
            targetSpeed = 1.15;
            org.behaviorState = 'BUILDER_DISPATCH_TO_SITE';
          }
        }
      } else if (org.caste === 'HARVESTER' && (org.isCarryingFood || org.metabolism.getTelemetry().glucoseLevel > 0.8)) {
        let nearestSilo: UrbanStructure | null = null;
        let minDist = 999;
        for (const s of this.metropolisEngine.structures.values()) {
          if (s.type === 'CENTRAL_SILO' && s.constructionProgress >= 1.0) {
            const d = Math.hypot(s.x - org.x, s.y - org.y);
            if (d < minDist) {
              minDist = d;
              nearestSilo = s;
            }
          }
        }
        if (nearestSilo && minDist > 1.2) {
          const dx = nearestSilo.x - org.x;
          const dy = nearestSilo.y - org.y;
          const targetAngle = Math.atan2(dy, dx);
          const diff = shortestAngleDiff(targetAngle, org.headingRad);
          turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 3.6);
          targetSpeed = 1.25;
          org.behaviorState = 'HARVESTER_DELIVERING_SILO';
        }
      } else if (org.caste === 'NURSE' && org.metabolism.getTelemetry().atpLevel > 0.4) {
        const weakOrg = Array.from(this.organisms.values()).find(
          (other) => other.id !== org.id && !other.isDecomposing && other.metabolism.getTelemetry().atpLevel < 0.32
        );
        if (weakOrg) {
          const dx = weakOrg.x - org.x;
          const dy = weakOrg.y - org.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.5) {
            const targetAngle = Math.atan2(dy, dx);
            const diff = shortestAngleDiff(targetAngle, org.headingRad);
            turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 4.0);
            targetSpeed = 1.2;
            org.behaviorState = 'NURSE_APPROACHING_PATIENT';
          } else {
            weakOrg.metabolism.revive(Math.min(0.65, weakOrg.metabolism.getTelemetry().atpLevel + 0.12 * dt));
            org.metabolism.expendAtp(0.05 * dt);
            org.currentThought = `🩹 Asistiendo vitalmente a espécimen G${weakOrg.generation}.`;
            weakOrg.currentThought = '💖 Recibiendo auxilio vital de Enfermero.';
            org.behaviorState = 'MEDICAL_TROPHALLAXIS';
          }
        }
      }

      // 4.3 Actualización de Rumbo y Desplazamiento
      // 4.3 Modulación por Calzada Bioluminiscente Urbana (Pheromone Highway)
      const hwyBonus = this.metropolisEngine.getHighwaySpeedMultiplier(org.x, org.y);
      if (hwyBonus > 1.0) {
        targetSpeed *= hwyBonus;
      }

      if (!(org.isLeader && org.species === 'DROSOPHILA' && connectomeBioBridge.isConnectomeActive())) {
        org.headingRad = normalizeAngle(org.headingRad + turnRateRadPerSec * dt);
        org.speedMps += (targetSpeed - org.speedMps) * Math.min(1.0, 5.0 * dt);
      }

      let nextX = org.x + Math.cos(org.headingRad) * org.speedMps * dt;
      let nextY = org.y + Math.sin(org.headingRad) * org.speedMps * dt;

      // 4.4 Colisión con Barreras Acústicas Infranqueables
      const nextGridX = nextX + centerOffset;
      const nextGridY = nextY + centerOffset;
      if (this.diffusionGrid.isPointBlocked(nextGridX, nextGridY)) {
        org.headingRad = normalizeAngle(org.headingRad + Math.PI + (Math.random() - 0.5) * 0.6);
        nextX = org.x;
        nextY = org.y;
      } else {
        org.x = nextX;
        org.y = nextY;
      }

      if (org.species === 'DROSOPHILA') {
        const targetAlt = org.flightAltitudeTargetMeters !== undefined ? org.flightAltitudeTargetMeters : 0.05;
        org.altitudeMeters += (targetAlt - org.altitudeMeters) * Math.min(1.0, dt * 4.0);
        org.z = org.altitudeMeters;
      }

      // 4.45 Interacciones Cívicas y Urbanismo Estigmérgico
      if (org.caste === 'HARVESTER' && (org.isCarryingFood || org.metabolism.getTelemetry().glucoseLevel > 0.75)) {
        const dep = this.metropolisEngine.depositInNearestSilo(org.x, org.y, 3.5, 1.8);
        if (dep && dep.acceptedGlucose > 0) {
          org.isCarryingFood = false;
          org.currentThought = '📦 Descargando provisiones en el Silo Central de la metrópolis.';
          org.plasticity.injectDopamine(2.0);
        }
      }

      if (org.metabolism.getTelemetry().atpLevel < 0.28) {
        const withdrawn = this.metropolisEngine.withdrawFromNearestSilo(org.x, org.y, 0.45);
        if (withdrawn > 0) {
          org.metabolism.ingestNutrient(withdrawn * 2.0);
          org.currentThought = '🌾 Reabastecido por las reservas comunales del Silo.';
        }
      }

      if (org.caste === 'BUILDER') {
        const contributed = this.metropolisEngine.contributeToConstruction(org.x, org.y, 1.2 * dt);
        if (contributed) {
          org.currentThought = '🔨 Erigiendo infraestructura estigmérgica en el sector.';
          org.plasticity.injectDopamine(0.8 * dt);
        }
      }

      // 4.5 Trabajo mecánico celular (las calzadas reducen el consumo en 40%)
      const energyFriction = hwyBonus > 1.0 ? 0.6 : 1.0;
      const mechanicalPower = org.speedMps * 2.0 * energyFriction;
      const spikeCount = 35 + Math.floor(org.speedMps * 25 * energyFriction);
      org.metabolism.step(dt, spikeCount, mechanicalPower);

      // 4.6 Confinamiento Perimétrico y Migración P2P
      const distFromCenter = Math.hypot(org.x, org.y);
      if (distFromCenter >= BiocyberneticHabitatEngine.ARENA_RADIUS_METERS) {
        if (this.meshBridge.getTelemetry().connectedMeshPeersCount > 0 && Math.random() < 0.25) {
          this.meshBridge.broadcastEmigration(
            org.species,
            org.metabolism.getTelemetry().atpLevel,
            org.headingRad,
            org.speedMps,
            org.generation,
            org.plasticity.quantizeForMeshExport()
          );
          if (org.homeCellId) {
            this.metropolisEngine.setCellOccupancy(org.homeCellId, false, false);
          }
          this.organisms.delete(id);
          continue;
        } else {
          const normalAngle = Math.atan2(org.y, org.x);
          org.headingRad = normalizeAngle(Math.PI + 2 * normalAngle - org.headingRad);
          org.x = Math.cos(normalAngle) * (BiocyberneticHabitatEngine.ARENA_RADIUS_METERS - 0.05);
          org.y = Math.sin(normalAngle) * (BiocyberneticHabitatEngine.ARENA_RADIUS_METERS - 0.05);
        }
      }

      // 4.7 Reproducción A-Life (Mitosis/Oviposición por Saciedad Energética con Herencia y Mutación)
      if (org.metabolism.getTelemetry().atpLevel > 0.80 && !org.isDecomposing && org.ageSec > 10.0) {
        org.satietyTimerSec += dt;
        if (org.satietyTimerSec >= 10.0 && this.organisms.size < 24) {
          org.satietyTimerSec = 0;
          org.metabolism.expendAtp(0.30);
          org.offspringCount++;

          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnDist = 0.85 + Math.random() * 0.4;
          const offspring = this.spawnOrganism(
            org.species,
            org.x + Math.cos(spawnAngle) * spawnDist,
            org.y + Math.sin(spawnAngle) * spawnDist,
            spawnAngle,
            false,
            org.genome,
            org.id
          );
          offspring.plasticity.inheritFromParentWithMutation(org.plasticity, org.genome.mutationRateGene);
          TacticalAudioEngine.playMitosisChime();
        }
      }
    }

    // 5. Exclusión Física de Cuerpos Sólidos (Elastic Non-Penetration Solver)
    const activeOrgs = Array.from(this.organisms.values()).filter(o => !o.isDecomposing);
    for (let i = 0; i < activeOrgs.length; i++) {
      const oA = activeOrgs[i];
      const rA = BiocyberneticHabitatEngine.getSpeciesRadius(oA.species);

      for (let j = i + 1; j < activeOrgs.length; j++) {
        const oB = activeOrgs[j];
        const rB = BiocyberneticHabitatEngine.getSpeciesRadius(oB.species);

        const dx = oA.x - oB.x;
        const dy = oA.y - oB.y;
        const dist = Math.hypot(dx, dy);
        const minDist = rA + rB;

        if (dist < minDist) {
          const overlap = minDist - dist;
          let nx = dx / (dist || 0.001);
          let ny = dy / (dist || 0.001);

          if (dist < 0.001) {
            const randAngle = Math.random() * Math.PI * 2;
            nx = Math.cos(randAngle);
            ny = Math.sin(randAngle);
          }

          // Impulso de separación elástica del 52% para romper solapamientos
          const pushX = nx * overlap * 0.52;
          const pushY = ny * overlap * 0.52;

          const nextAX = oA.x + pushX;
          const nextAY = oA.y + pushY;
          const nextBX = oB.x - pushX;
          const nextBY = oB.y - pushY;

          const rLimit = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS - 0.05;
          const distA = Math.hypot(nextAX, nextAY);
          const distB = Math.hypot(nextBX, nextBY);

          // Verificar límites contra barreras y perímetro circular
          if (!this.diffusionGrid.isPointBlocked(nextAX + centerOffset, nextAY + centerOffset)) {
            if (distA < rLimit) {
              oA.x = nextAX;
              oA.y = nextAY;
            } else {
              const aAngle = Math.atan2(nextAY, nextAX);
              oA.x = Math.cos(aAngle) * rLimit;
              oA.y = Math.sin(aAngle) * rLimit;
            }
            if (oA.species === 'C_ELEGANS' && oA.wormJoints.length > 0) {
              oA.wormJoints[0] = { x: oA.x, y: oA.y };
            }
          }
          if (!this.diffusionGrid.isPointBlocked(nextBX + centerOffset, nextBY + centerOffset)) {
            if (distB < rLimit) {
              oB.x = nextBX;
              oB.y = nextBY;
            } else {
              const bAngle = Math.atan2(nextBY, nextBX);
              oB.x = Math.cos(bAngle) * rLimit;
              oB.y = Math.sin(bAngle) * rLimit;
            }
            if (oB.species === 'C_ELEGANS' && oB.wormJoints.length > 0) {
              oB.wormJoints[0] = { x: oB.x, y: oB.y };
            }
          }
        }
      }
    }
  }

  /**
   * Procesa la llegada de un organismo inmigrante transmitido por la malla P2P.
   */
  private handleIncomingImmigrant(immigrant: ImmigrantOrganismData): void {
    const spawnAngle = immigrant.headingRad + Math.PI;
    const spawnR = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS * 0.92;
    const x = Math.cos(spawnAngle) * spawnR;
    const y = Math.sin(spawnAngle) * spawnR;

    const org = this.spawnOrganism(immigrant.type, x, y, immigrant.headingRad, false);
    org.generation = immigrant.generation + 1;
    org.metabolism.revive(immigrant.atpLevel);
    org.plasticity.restoreFromQuantizedMesh(immigrant.synapticWeights);
    console.log(`[BiocyberneticHabitatEngine] 🧬 Inmigrante P2P recibido de ${immigrant.originPeerId.slice(0, 8)}`);
  }

  // ── Herramientas de Experimentación Táctica del Operador ──────────────────────

  public setTool(tool: HabitatToolType, intensity: number = 1.0): void {
    this.activeToolState.activeTool = tool;
    this.activeToolState.intensity = intensity;
  }

  public applyToolAt(x: number, y: number): void {
    this.activeToolState.cursorX = x;
    this.activeToolState.cursorY = y;
    const centerOffset = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
    const gridX = x + centerOffset;
    const gridY = y + centerOffset;

    switch (this.activeToolState.activeTool) {
      case 'GLUCOSE_PIPETTE': {
        const source: ChemicalSource = {
          id: `glucose-drop-${Date.now()}`,
          x: gridX,
          y: gridY,
          substance: 'GLUCOSE',
          emissionRate: 1.6 * this.activeToolState.intensity,
          currentMass: 25.0 * this.activeToolState.intensity,
          radius: 0.35,
        };
        this.diffusionGrid.addSource(source);
        TacticalAudioEngine.playTap();
        break;
      }
      case 'HEAT_INFRARED': {
        this.diffusionGrid.injectChemical(gridX, gridY, 18.0 * this.activeToolState.intensity, 'ALARM_PHEROMONE');
        TacticalAudioEngine.playAlert();
        break;
      }
      case 'AIR_PUFF_POKE': {
        this.triggerAirPuff(x, y, this.activeToolState.intensity);
        break;
      }
      case 'OPTOGENETIC_LASER':
      case 'OPTOGENETIC_CHR2': {
        this.applyOptogeneticLaser(x, y, 1.2);
        TacticalAudioEngine.playOptoLaser();
        break;
      }
      case 'LOOMING_SHADOW': {
        this.shadows.push({
          id: `shadow-${Date.now()}`,
          x,
          y,
          z: 0,
          radiusMeters: 0.2,
          velocityMps: 2.8 * this.activeToolState.intensity,
          durationSec: 2.2,
        });
        TacticalAudioEngine.playWarning();
        break;
      }
      case 'ACOUSTIC_BARRIER': {
        // Colocar una barrera radial de 1.5 m orientada
        const len = 1.5 * this.activeToolState.intensity;
        const bX1 = gridX - len * 0.5;
        const bY1 = gridY;
        const bX2 = gridX + len * 0.5;
        const bY2 = gridY;
        this.diffusionGrid.addBarrier({
          id: `barrier-${Date.now()}`,
          x1: bX1,
          y1: bY1,
          x2: bX2,
          y2: bY2,
        });
        TacticalAudioEngine.playTap();
        break;
      }
      case 'NONE':
        break;
    }
  }

  public triggerAirPuff(x: number, y: number, strength: number = 1.0): void {
    this.airPuffWaves.push({
      id: `puff-${Date.now()}`,
      x,
      y,
      radiusMeters: 0.1,
      maxRadiusMeters: 3.5 * strength,
      strength,
      durationSec: 0.8,
    });
    TacticalAudioEngine.playBioPuff();
  }

  public applyOptogeneticLaser(x: number, y: number, radiusMeters: number = 1.0): void {
    for (const org of this.organisms.values()) {
      const dist = Math.hypot(org.x - x, org.y - y);
      if (dist <= radiusMeters) {
        org.plasticity.injectDopamine(1.0);
        org.speedMps = Math.min(3.5, org.speedMps + 1.2);
      }
    }
  }

  public clearAcousticBarriers(): void {
    this.diffusionGrid.clearBarriers();
    TacticalAudioEngine.playTap();
  }

  public getAirPuffWaves(): AirPuffWave[] {
    return this.airPuffWaves;
  }

  public setActuatorStreaming(streaming: boolean): void {
    this.isActuatorStreaming = streaming;
    hexapodActuatorBridge.setStreaming(streaming);
  }

  /**
   * Asegura la sucesión dinástica ininterrumpida del organismo líder.
   * Si el líder actual fenece o entra en descomposición, transfiere el rol
   * preferentemente a la Drosophila viva más madura/apta (o a cualquier espécimen vivo),
   * garantizando que el lazo sensoriomotor cerrado con el conectoma MaleCNS no quede huérfano.
   */
  private ensureLeaderSuccession(): void {
    // 1. Si ya existe un líder vivo no en descomposición, no hay vacancia
    for (const org of this.organisms.values()) {
      if (org.isLeader && !org.isDecomposing) return;
    }

    // 2. Limpiar banderas de líder en organismos en descomposición
    for (const org of this.organisms.values()) {
      if (org.isDecomposing) org.isLeader = false;
    }

    // 3. Prioridad 1: Candidato vivo DROSOPHILA no en descomposición más maduro
    let bestCandidate: HabitatOrganism | null = null;
    for (const org of this.organisms.values()) {
      if (org.isDecomposing) continue;
      if (org.species === 'DROSOPHILA') {
        if (!bestCandidate || org.ageSec > bestCandidate.ageSec) {
          bestCandidate = org;
        }
      }
    }

    // 4. Prioridad 2: Si no hay Drosophila, promover el organismo vivo más maduro de cualquier especie
    if (!bestCandidate) {
      for (const org of this.organisms.values()) {
        if (!org.isDecomposing) {
          if (!bestCandidate || org.ageSec > bestCandidate.ageSec) {
            bestCandidate = org;
          }
        }
      }
    }

    if (bestCandidate) {
      bestCandidate.isLeader = true;
    }
  }

  public getLeader(): HabitatOrganism | undefined {
    this.ensureLeaderSuccession();
    for (const org of this.organisms.values()) {
      if (org.isLeader && !org.isDecomposing) return org;
    }
    return undefined;
  }

  public getLeaderOrganism(): HabitatOrganism | undefined {
    return this.getLeader();
  }

  public getNearestShadowDistance(x: number, y: number): number {
    if (this.shadows.length === 0) return 999.0;
    let minDist = 999.0;
    for (const sh of this.shadows) {
      const dist = Math.hypot(sh.x - x, sh.y - y);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }

  public getNearestAirPuffIntensity(x: number, y: number): number {
    if (this.airPuffWaves.length === 0) return 0.0;
    let maxIntensity = 0.0;
    for (const wave of this.airPuffWaves) {
      const dist = Math.hypot(wave.x - x, wave.y - y);
      if (Math.abs(dist - wave.radiusMeters) < 0.8) {
        if (wave.strength > maxIntensity) maxIntensity = wave.strength;
      }
    }
    return maxIntensity;
  }

  public static getSpeciesRadius(species: OrganismSpecies): number {
    switch (species) {
      case 'DROSOPHILA':
        return 0.38;
      case 'ANT':
        return 0.32;
      case 'C_ELEGANS':
        return 0.22;
      case 'HUMAN_NEOCORTEX':
        return 0.35;
      case 'GRAVITY_SENTINEL':
        return 0.45;
      default:
        return 0.30;
    }
  }

  public getSpeciesDisplayName(species: OrganismSpecies): string {
    switch (species) {
      case 'DROSOPHILA':
        return 'Drosophila (Mosca)';
      case 'GRAVITY_SENTINEL':
        return 'Dron Gravity AI';
      case 'HUMAN_NEOCORTEX':
        return 'Neocorteza Humana';
      case 'C_ELEGANS':
        return 'C. elegans (Gusano)';
      case 'ANT':
        return 'Hormiga Obrera';
      default:
        return 'Organismo';
    }
  }

  public generateLivingThought(org: HabitatOrganism): void {
    let thought = '';
    let mood: OrganismMood = 'CURIOUS';

    if (this.sugarRace.isActive) {
      mood = 'COMPETITIVE';
      if (org.species === 'DROSOPHILA') {
        thought = '¡El Gran Torneo! ¡Marcha a máxima frecuencia por el cristal! 🏆';
      } else if (org.species === 'GRAVITY_SENTINEL') {
        thought = '🎙️ [CRÓNICA AI]: ¡Competidores aproximándose a coordenadas meta! 📢';
      } else if (org.species === 'HUMAN_NEOCORTEX') {
        thought = 'Calculando trayectoria óptima bayesiana hacia el premio 🏁';
      } else if (org.species === 'ANT') {
        thought = '¡Carga de velocidad máxima por la Reina y el nido! 🐜⚡';
      } else if (org.species === 'C_ELEGANS') {
        thought = 'Ondulación acelerada hacia la vibración del cristal 🐛💨';
      }
    } else if (org.pettedTimerSec > 0) {
      mood = 'PLAYFUL';
      if (org.species === 'DROSOPHILA') thought = '¡Bzzzz! ¡Eso hace cosquillas en mis antenas! ✨💖';
      else if (org.species === 'GRAVITY_SENTINEL') thought = 'Caricia recibida. Ronroneo iónico modulado en 440 Hz 🛸💖';
      else if (org.species === 'HUMAN_NEOCORTEX') thought = 'Sincronía interoceptiva y afecto registrados en la ínsula 🧠💖';
      else if (org.species === 'ANT') thought = '¡Antenas batiendo de alegría! Agradecimiento obrero 🐜💖';
      else if (org.species === 'C_ELEGANS') thought = 'Ondulación suave y relajada... liberando serotonina 🐛💖';
    } else if (org.laserChaseTarget) {
      mood = 'PLAYFUL';
      if (org.species === 'DROSOPHILA') thought = '¡Un fotón brillante! ¿Es optogenética o juego? ¡A por él! ⚡';
      else if (org.species === 'GRAVITY_SENTINEL') thought = 'Punto de referencia detectado. Fijando haz de escaneo 🎯';
      else if (org.species === 'HUMAN_NEOCORTEX') thought = 'Atención selectiva focalizada en el estímulo luminoso 💡';
      else if (org.species === 'ANT') thought = '¿Qué es esta luz danzante? Investigando con mandíbulas 🔍';
      else if (org.species === 'C_ELEGANS') thought = 'Sintiendo fotones... ondulando hacia el destello 🐛✨';
    } else {
      const atp = org.metabolism.getTelemetry().atpLevel;
      if (atp < 0.3) {
        mood = 'HUNGRY';
        thought = org.species === 'DROSOPHILA'
          ? 'ATP bajo... Mis 124,289 neuronas necesitan glucosa urgente ⚠️'
          : org.species === 'GRAVITY_SENTINEL'
          ? 'Batería en 28%. Modo de bajo consumo activo 🔋'
          : org.species === 'HUMAN_NEOCORTEX'
          ? 'Glucemia en declive: priorizando fuentes energéticas 🍞'
          : 'Buscando nutrientes en el sustrato... 🌾';
      } else if (org.behaviorState.includes('FEEDING') || org.behaviorState.includes('GLUCOSE')) {
        mood = 'HUNGRY';
        thought = org.species === 'DROSOPHILA'
          ? '¡Sacarosa pura bajo mis patas! Absorbiendo y liberando dopamina 🍓'
          : org.species === 'ANT'
          ? '¡Cristal de glucosa localizado! Fragmentando para llevar al nido 🐜'
          : org.species === 'C_ELEGANS'
          ? 'Quimiotaxis cumplida. Disfrutando del gradiente azucarado 🍯'
          : 'Asimilando energía bioquímica para la red ⚡';
      } else {
        mood = Math.random() < 0.5 ? 'CURIOUS' : 'ZEN';
        if (org.species === 'DROSOPHILA') {
          if (org.civicActionDescription && Math.random() < 0.75) {
            thought = org.civicActionDescription;
          } else {
            const flyThoughts = [
              'Brújula E-PG centrada en rumbo cívico. Navegando la metrópolis 🧭',
              'Limpiando mis alas translúcidas en el helipuerto de la torre ✨',
              'Sintiendo corrientes térmicas entre los rascacielos 🍃',
              'Vuelo rasante por la avenida principal sincronizado 🪰',
            ];
            thought = flyThoughts[Math.floor(Math.random() * flyThoughts.length)];
          }
        } else if (org.species === 'GRAVITY_SENTINEL') {
          const sentinelThoughts = [
            'Malla soberana RED: 0 vulnerabilidades. Cero telemetry leaks 🛡️',
            'Escaneando firmas biológicas del biodomo... 100% vitalidad 🛸',
            'Propulsores en resonancia armónica. Altura de crucero estable 📡',
            'Listo para mediar en el próximo Gran Torneo de Glucosa 🏆',
          ];
          thought = sentinelThoughts[Math.floor(Math.random() * sentinelThoughts.length)];
        } else if (org.species === 'HUMAN_NEOCORTEX') {
          const humanThoughts = [
            'Minimizando energía libre de Friston: predicción del entorno confirmada 🧠',
            'Memoria episódica en CA3 activa: reconociendo patrones previos 📖',
            'Teoría de la mente activa: observando la cooperación de las hormigas 🐜',
            'Rejilla entorrinal hexagonal proyectada en las coordenadas locales 🗺️',
          ];
          thought = humanThoughts[Math.floor(Math.random() * humanThoughts.length)];
        } else if (org.species === 'C_ELEGANS') {
          const wormThoughts = [
            'Ondulando en armonía sinusoidal continua con el sustrato 🌊',
            'Klinokinesis en calma. Las 302 neuronas están felices 🧘',
            'Temperatura ambiental perfecta para la cutícula translúcida 🐛',
          ];
          thought = wormThoughts[Math.floor(Math.random() * wormThoughts.length)];
        } else if (org.species === 'ANT') {
          const antThoughts = [
            '¡Trabajo en equipo! La estigmergia es la clave de la inteligencia 🐜',
            'Trazando rastro de feromona para guiar a las demás hermanas 🛤️',
            'Mandíbulas afiladas y listas para cualquier tarea comunitaria ⚙️',
          ];
          thought = antThoughts[Math.floor(Math.random() * antThoughts.length)];
        }
      }
    }

    org.currentThought = thought;
    org.mood = mood;

    // Registrar en el historial de pensamientos recientes (ring buffer de 8 entradas)
    this.recentThoughts.unshift({
      id: org.id,
      species: org.species,
      name: this.getSpeciesDisplayName(org.species),
      thought,
      mood,
      timestamp: Date.now(),
    });
    if (this.recentThoughts.length > 8) {
      this.recentThoughts.pop();
    }
  }

  public startSugarRace(): void {
    const angle = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 4.0;
    const targetX = Math.cos(angle) * r;
    const targetY = Math.sin(angle) * r;

    this.sugarRace = {
      isActive: true,
      targetX,
      targetY,
      timeRemainingSec: 25.0,
      winnerSpecies: null,
      winnerName: null,
      announcement: '🏆 ¡EL GRAN TORNEO DE GLUCOSA HA COMENZADO! Todas las inteligencias van por el Mega-Cristal.',
    };

    // Alertar y motivar a todos los organismos
    for (const org of this.organisms.values()) {
      org.mood = 'COMPETITIVE';
      org.thoughtTimerSec = 0.1;
      org.laserChaseTarget = null;
    }

    TacticalAudioEngine.playRogerBeep();
  }

  public cancelSugarRace(): void {
    this.sugarRace.isActive = false;
    this.sugarRace.announcement = 'Gran Torneo finalizado.';
  }

  public triggerPlayfulLaser(x: number, y: number): void {
    this.laserChaseGlobalTarget = { x, y };
    this.laserChaseTimerSec = 8.0;

    for (const org of this.organisms.values()) {
      if (Math.hypot(org.x - x, org.y - y) <= 8.0) {
        org.laserChaseTarget = { x, y };
        org.mood = 'PLAYFUL';
        org.thoughtTimerSec = 0.2;
      }
    }
  }

  public triggerNectarShower(): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 7.5;
      const x = Math.cos(angle) * r + BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
      const y = Math.sin(angle) * r + BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;
      this.diffusionGrid.injectChemical(x, y, 4.0, 'GLUCOSE');
    }

    for (const org of this.organisms.values()) {
      org.mood = 'ENERGETIC';
      org.metabolism.ingestNutrient(0.25);
    }

    TacticalAudioEngine.playDopamineChime();
  }

  public triggerAcrobaticWind(): void {
    this.triggerAirPuff(0, 0, 1.0);
    for (const org of this.organisms.values()) {
      org.acrobaticTimerSec = 2.5;
      org.mood = 'PLAYFUL';
    }
    TacticalAudioEngine.playRogerBeep();
  }

  public petOrganism(id: string): string {
    const org = this.organisms.get(id);
    if (!org) return 'Organismo no encontrado.';

    org.pettedTimerSec = 4.0;
    org.mood = 'PLAYFUL';
    org.plasticity.injectDopamine(10.0);
    this.generateLivingThought(org);

    TacticalAudioEngine.playDopamineChime();

    if (org.species === 'DROSOPHILA') return '¡Acariciaste a Drosophila! Sus antenas vibran y libera dopamina ✨🪰';
    if (org.species === 'GRAVITY_SENTINEL') return '¡Acariciaste al Dron Gravity AI! Sus propulsores ronronean con afecto 🛸💖';
    if (org.species === 'HUMAN_NEOCORTEX') return '¡Sincronía empática con el Avatar Humano! Resonancia en la ínsula 🧠💖';
    if (org.species === 'C_ELEGANS') return '¡Acariciaste a C. elegans! Ondula en espirales de alegría 🐛✨';
    return '¡Acariciaste a la Hormiga Obrera! Bate sus antenas con júbilo 🐜💖';
  }

  public feedOrganismTreat(id: string): string {
    const org = this.organisms.get(id);
    if (!org) return 'Organismo no encontrado.';

    org.metabolism.ingestNutrient(1.0);
    org.plasticity.injectDopamine(15.0);
    org.mood = 'HUNGRY';
    this.generateLivingThought(org);

    TacticalAudioEngine.playDopamineChime();
    return `🍰 ¡Alimentaste a ${this.getSpeciesDisplayName(org.species)} con néctar puro! ATP restablecido al 100%.`;
  }

  public talkToOrganism(id: string): string {
    const org = this.organisms.get(id);
    if (!org) return 'Organismo no disponible.';
    this.generateLivingThought(org);
    return `"${org.currentThought}"`;
  }

  public getSugarRaceState(): SugarRaceState {
    return this.sugarRace;
  }

  public getLaserChaseTarget(): { x: number; y: number } | null {
    return this.laserChaseTimerSec > 0 ? this.laserChaseGlobalTarget : null;
  }

  public getRecentThoughts(): CognitiveThoughtEntry[] {
    return this.recentThoughts;
  }

  public getNearestOrganismOfSpecies(
    x: number,
    y: number,
    species: OrganismSpecies,
    excludeId: string
  ): { org: HabitatOrganism; dist: number } | null {
    let nearest: { org: HabitatOrganism; dist: number } | null = null;
    for (const org of this.organisms.values()) {
      if (org.id === excludeId || org.isDecomposing || org.species !== species) continue;
      const dist = Math.hypot(org.x - x, org.y - y);
      if (!nearest || dist < nearest.dist) {
        nearest = { org, dist };
      }
    }
    return nearest;
  }

  public getNearestInsect(
    x: number,
    y: number,
    excludeId: string
  ): { org: HabitatOrganism; dist: number } | null {
    let nearest: { org: HabitatOrganism; dist: number } | null = null;
    for (const org of this.organisms.values()) {
      if (org.id === excludeId || org.isDecomposing || org.species === 'C_ELEGANS') continue;
      const dist = Math.hypot(org.x - x, org.y - y);
      if (!nearest || dist < nearest.dist) {
        nearest = { org, dist };
      }
    }
    return nearest;
  }

  public getOrganism(id: string): HabitatOrganism | undefined {
    return this.organisms.get(id);
  }

  public getActiveTool(): HabitatToolType {
    return this.activeToolState.activeTool;
  }

  public getActiveToolState(): TacticalToolState {
    return { ...this.activeToolState };
  }

  public getAllOrganisms(): HabitatOrganism[] {
    return Array.from(this.organisms.values());
  }

  public subscribeTelemetry(cb: (t: HabitatTelemetry) => void): () => void {
    this.telemetryListeners.add(cb);
    cb(this.getTelemetry());
    return () => this.telemetryListeners.delete(cb);
  }

  private notifyTelemetry(): void {
    const tel = this.getTelemetry();
    this.telemetryListeners.forEach(cb => {
      try {
        cb(tel);
      } catch {}
    });
  }

  public getTelemetry(): HabitatTelemetry {
    const leader = this.getLeader();
    const metaTel = leader ? leader.metabolism.getTelemetry() : null;
    const meshTel = this.meshBridge.getTelemetry();

    let drosophilaCount = 0;
    let cElegansCount = 0;
    let antCount = 0;
    let humanNeocortexCount = 0;
    let gravitySentinelCount = 0;

    for (const org of this.organisms.values()) {
      if (org.isDecomposing) continue;
      if (org.species === 'DROSOPHILA') drosophilaCount++;
      else if (org.species === 'C_ELEGANS') cElegansCount++;
      else if (org.species === 'ANT') antCount++;
      else if (org.species === 'HUMAN_NEOCORTEX') humanNeocortexCount++;
      else if (org.species === 'GRAVITY_SENTINEL') gravitySentinelCount++;
    }

    const casteCounts: Record<CivilianCaste, number> = {
      BUILDER: 0,
      HARVESTER: 0,
      SENTINEL: 0,
      SCHOLAR: 0,
      NURSE: 0,
    };
    for (const org of this.organisms.values()) {
      if (!org.isDecomposing && org.caste) {
        casteCounts[org.caste] = (casteCounts[org.caste] || 0) + 1;
      }
    }

    return {
      organismCount: this.organisms.size,
      leaderAtp: metaTel ? metaTel.atpLevel : 0,
      leaderGlucose: metaTel ? metaTel.glucoseLevel : 0,
      leaderState: leader ? leader.behaviorState : 'NONE',
      leaderSpecies: leader ? leader.species : 'DROSOPHILA',
      totalChemicalMassInGrid: this.diffusionGrid.getTotalMassInGrid('GLUCOSE'),
      activeSourcesCount: this.diffusionGrid.getAllSources().length,
      fickSimulationTimeSec: this.simTimeSec,
      isActuatorStreaming: this.isActuatorStreaming,
      activeTool: this.activeToolState.activeTool,
      p2pMigrationsEmitted: meshTel.totalEmigrations,
      p2pMigrationsReceived: meshTel.totalImmigrations,
      barrierCount: this.diffusionGrid.getBarriers().length,
      activeWavesCount: this.airPuffWaves.length,
      speciesBreakdown: {
        drosophila: drosophilaCount,
        cElegans: cElegansCount,
        ant: antCount,
        humanNeocortex: humanNeocortexCount,
        gravitySentinel: gravitySentinelCount,
      },
      sugarRace: this.sugarRace,
      recentThoughts: this.recentThoughts,
      chessMatch: {
        isActive: autonomousHabitatChess.isMatchActive,
        isPaused: autonomousHabitatChess.isPaused,
        whiteSpecies: autonomousHabitatChess.whiteSpecies,
        blackSpecies: autonomousHabitatChess.blackSpecies,
        whiteName: autonomousHabitatChess.whiteName,
        blackName: autonomousHabitatChess.blackName,
        currentTurn: autonomousHabitatChess.currentTurn,
        winner: autonomousHabitatChess.winner,
        moveCount: autonomousHabitatChess.moveHistory.length,
        lastMoveSan: autonomousHabitatChess.moveHistory.length > 0 ? autonomousHabitatChess.moveHistory[autonomousHabitatChess.moveHistory.length - 1].san : null,
        fen: autonomousHabitatChess.exportToFen(),
      },
      edenParadise: biocyberneticEdenParadise.getTelemetry(),
      lifelongLearning: autonomousLifelongLearning.getTelemetry(),
      timeScale: this.timeScale,
      maxGeneration: this.maxGenerationReached,
      populationGenetics: this.getPopulationGenetics(),
      evolutionChronicle: this.evolutionChronicle.slice(0, 25),
      metropolis: this.metropolisEngine.getTelemetry(casteCounts),
    };
  }

  public getMetropolisEngine(): BiocyberneticMetropolisEngine {
    return this.metropolisEngine;
  }

  public requestUrbanConstruction(type: UrbanStructureType, x: number, y: number, name?: string): UrbanStructure | null {
    return this.metropolisEngine.requestConstruction(type, x, y, name);
  }

  /**
   * Métodos de Control del Ajedrez Táctico In-Silico
   */
  public startChessMatch(
    whiteSpecies: OrganismSpecies = 'HUMAN_NEOCORTEX',
    blackSpecies: OrganismSpecies = 'GRAVITY_SENTINEL',
    whiteName: string = 'Neocórtex Alpha',
    blackName: string = 'Sentinel Aegis-1'
  ): void {
    autonomousHabitatChess.startNewMatch(whiteSpecies, blackSpecies, whiteName, blackName);
  }

  public toggleChessMatch(): void {
    if (!autonomousHabitatChess.isMatchActive) {
      autonomousHabitatChess.startNewMatch();
    } else {
      autonomousHabitatChess.isPaused = !autonomousHabitatChess.isPaused;
    }
  }

  public pauseChessMatch(): void {
    autonomousHabitatChess.isPaused = true;
  }

  public resumeChessMatch(): void {
    autonomousHabitatChess.isPaused = false;
  }

  public getChessEngine(): AutonomousHabitatChessEngine {
    return autonomousHabitatChess;
  }

  /**
   * Métodos de Control del Paraíso Biocibernético & Clima Edénico
   */
  public triggerAuroraBorealis(): void {
    biocyberneticEdenParadise.triggerAuroraBorealis();
  }

  public triggerNectarDew(): void {
    biocyberneticEdenParadise.triggerNectarDew(this.diffusionGrid);
  }

  public triggerSerotoninBreeze(): void {
    biocyberneticEdenParadise.triggerSerotoninBreeze(this.diffusionGrid);
  }

  public triggerMeditationRepose(): void {
    biocyberneticEdenParadise.triggerMeditationRepose();
  }

  public getEdenParadiseEngine(): BiocyberneticEdenParadiseEngine {
    return biocyberneticEdenParadise;
  }

  public getLifelongLearningEngine(): AutonomousLifelongLearningEngine {
    return autonomousLifelongLearning;
  }
}

export const biocyberneticHabitat = BiocyberneticHabitatEngine.getInstance();

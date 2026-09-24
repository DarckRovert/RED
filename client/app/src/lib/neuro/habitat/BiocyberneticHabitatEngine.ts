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

export type OrganismSpecies = 'DROSOPHILA' | 'C_ELEGANS' | 'ANT';

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
  };
}

export class BiocyberneticHabitatEngine {
  private static instance: BiocyberneticHabitatEngine | null = null;

  public static readonly ARENA_RADIUS_METERS = 10.0;
  public static readonly ARENA_DIAMETER_METERS = 20.0;
  public static readonly FIXED_TIMESTEP_SEC = 1.0 / 60.0; // 60 Hz exactos (~16.66 ms)

  public readonly diffusionGrid: FickDiffusionGrid;
  public readonly meshBridge: HabitatMeshBridgeEngine;

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
  private animFrameId: any = null;

  private isActuatorStreaming = false;
  private kineticStressUnsub: (() => void) | null = null;
  private meshBridgeUnsub: (() => void) | null = null;

  private telemetryListeners: Set<(t: HabitatTelemetry) => void> = new Set();

  private constructor() {
    this.diffusionGrid = new FickDiffusionGrid(
      BiocyberneticHabitatEngine.ARENA_DIAMETER_METERS,
      BiocyberneticHabitatEngine.ARENA_DIAMETER_METERS,
      64
    );
    this.meshBridge = HabitatMeshBridgeEngine.getInstance();

    // Iniciar con un ecosistema inicial balanceado
    this.spawnOrganism('DROSOPHILA', -1.5, 0, 0, true);
    this.spawnOrganism('C_ELEGANS', 1.5, -1.0, Math.PI * 0.5, false);
    this.spawnOrganism('ANT', 0, 1.5, Math.PI, false);
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

    // 2. Iniciar enlace de migración P2P
    this.meshBridge.start();
    this.meshBridgeUnsub = this.meshBridge.onOrganismImmigrated((immigrant) => {
      this.handleIncomingImmigrant(immigrant);
    });

    // 3. Lanzar bucle con acumulador temporal
    const loop = (currentTimestamp: number) => {
      if (!this.isRunning) return;

      const frameDeltaSec = Math.min(0.1, (currentTimestamp - this.lastFrameTimestamp) / 1000.0);
      this.lastFrameTimestamp = currentTimestamp;
      this.accumulator += frameDeltaSec;

      while (this.accumulator >= BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC) {
        this.physicsTick(BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC);
        this.accumulator -= BiocyberneticHabitatEngine.FIXED_TIMESTEP_SEC;
      }

      this.notifyTelemetry();

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
  }

  /**
   * Crea e introduce un nuevo organismo en el hábitat.
   */
  public spawnOrganism(
    species: OrganismSpecies = 'DROSOPHILA',
    x: number = 0,
    y: number = 0,
    headingRad: number = 0,
    isLeader: boolean = false
  ): HabitatOrganism {
    const id = `org-${species.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const wormJoints = [];
    for (let j = 0; j < 10; j++) {
      wormJoints.push({
        x: x - Math.cos(headingRad) * (j * 0.07),
        y: y - Math.sin(headingRad) * (j * 0.07),
      });
    }

    const org: HabitatOrganism = {
      id,
      species,
      x,
      y,
      z: 0,
      headingRad,
      speedMps: 0,
      generation: 1,
      metabolism: new BiocyberneticMetabolismEngine(1.0),
      eye: new OmmatidialCompoundEye(),
      plasticity: new PersistentSynapticPlasticityEngine(),
      isLeader,
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
    };

    this.organisms.set(id, org);
    return org;
  }

  /**
   * Tick biofísico discreto a 60 Hz exactos.
   */
  public physicsTick(dt: number): void {
    this.simTimeSec += dt;

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

    // 4. Actualizar organismos
    const centerOffset = BiocyberneticHabitatEngine.ARENA_RADIUS_METERS;

    for (const [id, org] of this.organisms.entries()) {
      // 4.0 Gestión de Biodegradación de Organismos Fenececidos
      if (org.isDecomposing) {
        org.decompositionRemainingSec -= dt;
        const gridX = org.x + centerOffset;
        const gridY = org.y + centerOffset;
        // La biomasa se disuelve lentamente en la grilla enriqueciendo el sustrato
        this.diffusionGrid.injectChemical(gridX, gridY, 0.04 * dt, 'GLUCOSE');
        if (org.decompositionRemainingSec <= 0) {
          this.organisms.delete(id);
        }
        continue;
      }

      if (org.metabolism.getTelemetry().isDead) {
        org.isDecomposing = true;
        org.behaviorState = 'DECAYING_BIOMASS';
        continue;
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

      if (org.species === 'DROSOPHILA') {
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
          org.behaviorState = 'FEEDING_GLUCOSE';
          TacticalAudioEngine.playDopamineChime();
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
          connectomeBioBridge.injectSensoryStimuli(
            org,
            antennalSample.meanConcentration,
            alarmSample,
            effectiveLoomingDist,
            nearestAirPuff,
            antennalSample.delta
          );
          // Decisiones Motoras del Cerebro (Compass E-PG, CPG, Giant Fiber) → Organismo Físico
          connectomeBioBridge.applyMotorCommands(org);
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
            org.headingRad = (escapeAngle + (Math.random() - 0.5) * 0.4) % (Math.PI * 2);
            org.speedMps = 3.6;
            targetSpeed = 3.6;
            org.behaviorState = 'EVADING_PREDATOR_ANT';
            org.plasticity.injectOctopamine(0.4);
            TacticalAudioEngine.playReflexEscape();
          } else if (distToAnt < 1.15 && nearestAnt) {
            // Alerta visual de aproximación de hormiga
            const awayAngle = Math.atan2(org.y - nearestAnt.org.y, org.x - nearestAnt.org.x);
            const diff = ((awayAngle - org.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            turnRateRadPerSec += Math.sign(diff) * 3.4;
            targetSpeed = 1.35;
            if (org.behaviorState === 'FORAGING_WALK') org.behaviorState = 'ALERT_PREDATOR_APPROACH';
          } else if (eyeTel.giantFiberTriggered) {
            org.speedMps = 3.8;
            turnRateRadPerSec += Math.PI * 0.8;
            org.behaviorState = 'GIANT_FIBER_ESCAPE';
            TacticalAudioEngine.playReflexEscape();
          } else {
            // INTERACCIÓN ECOLÓGICA 2: Distancia social conespecífica (Mosca ↔ Mosca)
            const nearestFly = this.getNearestOrganismOfSpecies(org.x, org.y, 'DROSOPHILA', org.id);
            if (nearestFly && nearestFly.dist < 0.65) {
              const repulseAngle = Math.atan2(org.y - nearestFly.org.y, org.x - nearestFly.org.x);
              const diff = ((repulseAngle - org.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
              turnRateRadPerSec += Math.sign(diff) * 2.6;
              if (org.behaviorState === 'FORAGING_WALK') org.behaviorState = 'TERRITORIAL_SPACING';
            }

            // Calibración de velocidad según estado biológico:
            if (isNearGlucose) {
              // DETENCIÓN PARA ALIMENTARSE (evita correr velozmente sobre el alimento)
              targetSpeed = 0.08 * org.metabolism.getLocomotionFactor();
              turnRateRadPerSec = (Math.random() - 0.5) * 0.4;
            } else if (antennalSample.meanConcentration > 0.008) {
              targetSpeed = 0.6 * org.metabolism.getLocomotionFactor();
              org.behaviorState = 'GLUCOSE_CHEMOTAXIS';
            } else {
              targetSpeed = 0.75 * org.metabolism.getLocomotionFactor();
              turnRateRadPerSec += (Math.random() - 0.5) * 1.4; // Meandro exploratorio
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
          TacticalAudioEngine.playDopamineChime();
        }

        // INTERACCIÓN ECOLÓGICA 3: Reflejo mecanosensorial por contacto de insecto (ALM/PLM)
        const nearestInsect = this.getNearestInsect(org.x, org.y, org.id);

        if (nearestInsect && nearestInsect.dist < 0.45) {
          // Contacto táctil mecánico: retirada retrógrada instantánea y pirueta
          const retreatAngle = Math.atan2(org.y - nearestInsect.org.y, org.x - nearestInsect.org.x);
          org.headingRad = (retreatAngle + (Math.random() - 0.5) * 0.4) % (Math.PI * 2);
          org.speedMps = 1.3;
          targetSpeed = 1.3;
          org.pirouetteTimerSec = 0.6;
          org.behaviorState = 'MECHANOSENSORY_TOUCH_REVERSAL';
          org.plasticity.injectOctopamine(0.35);
        } else if (alarmSample > 0.06) {
          // Nocicepción térmica reversa ante calor/alarma
          org.headingRad = (org.headingRad + Math.PI + (Math.random() - 0.5) * 0.4) % (Math.PI * 2);
          org.speedMps = 1.5;
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
              org.headingRad = (org.headingRad + turnAngle) % (Math.PI * 2);
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
            const diff = ((angleToFly - org.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
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
              nearestFly.org.headingRad = (angleToFly + Math.PI + (Math.random() - 0.5) * 0.4) % (Math.PI * 2);
              nearestFly.org.behaviorState = 'EVADING_PREDATOR_ANT';
              TacticalAudioEngine.playReflexEscape();
            }
          } else if (antennalGlucose.meanConcentration > 0.04) {
            // Encuentra alimento: ingesta y cambio a estado de retorno al nido
            org.metabolism.ingestNutrient(0.25 * dt);
            org.isCarryingFood = true;
            TacticalAudioEngine.playDopamineChime();
            // Gira hacia el nido / centro (0, 0)
            const angleToNest = Math.atan2(-org.y, -org.x);
            org.headingRad = angleToNest + (Math.random() - 0.5) * 0.3;
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
          const diff = ((angleToNest - org.headingRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          turnRateRadPerSec = Math.sign(diff) * Math.min(Math.abs(diff), 3.8);

          // Si llegó al nido (< 0.85 m del centro)
          if (Math.hypot(org.x, org.y) < 0.85) {
            org.isCarryingFood = false;
            org.nestExitCooldownSec = 2.8; // Período de salida sin volver a engancharse al rastro
            // Vector de salida radial hacia afuera del nido
            const outwardAngle = Math.atan2(org.y, org.x) + (Math.random() - 0.5) * 0.8;
            org.headingRad = outwardAngle;
            org.speedMps = 1.35;
            org.behaviorState = 'UNLOADED_FORAGING_OUTWARD';
            TacticalAudioEngine.playDopamineChime();
          }
        }
      }

      // 4.3 Actualización de Rumbo y Desplazamiento
      if (!(org.isLeader && org.species === 'DROSOPHILA' && connectomeBioBridge.isConnectomeActive())) {
        org.headingRad = (org.headingRad + turnRateRadPerSec * dt) % (Math.PI * 2);
        org.speedMps += (targetSpeed - org.speedMps) * Math.min(1.0, 5.0 * dt);
      }

      let nextX = org.x + Math.cos(org.headingRad) * org.speedMps * dt;
      let nextY = org.y + Math.sin(org.headingRad) * org.speedMps * dt;

      // 4.4 Colisión con Barreras Acústicas Infranqueables
      const nextGridX = nextX + centerOffset;
      const nextGridY = nextY + centerOffset;
      if (this.diffusionGrid.isPointBlocked(nextGridX, nextGridY)) {
        org.headingRad = (org.headingRad + Math.PI + (Math.random() - 0.5) * 0.6) % (Math.PI * 2);
        nextX = org.x;
        nextY = org.y;
      } else {
        org.x = nextX;
        org.y = nextY;
      }

      // 4.5 Trabajo mecánico celular
      const mechanicalPower = org.speedMps * 2.0;
      const spikeCount = 35 + Math.floor(org.speedMps * 25);
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
          this.organisms.delete(id);
          continue;
        } else {
          const normalAngle = Math.atan2(org.y, org.x);
          org.headingRad = Math.PI + 2 * normalAngle - org.headingRad;
          org.x = Math.cos(normalAngle) * (BiocyberneticHabitatEngine.ARENA_RADIUS_METERS - 0.05);
          org.y = Math.sin(normalAngle) * (BiocyberneticHabitatEngine.ARENA_RADIUS_METERS - 0.05);
        }
      }

      // 4.7 Reproducción A-Life (Mitosis/Oviposición por Saciedad Energética con Dispersión Segura)
      if (org.metabolism.getTelemetry().atpLevel > 0.82 && !org.isDecomposing) {
        org.satietyTimerSec += dt;
        if (org.satietyTimerSec >= 15.0 && this.organisms.size < 22) {
          org.satietyTimerSec = 0;
          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnDist = 0.85 + Math.random() * 0.3;
          const offspring = this.spawnOrganism(
            org.species,
            org.x + Math.cos(spawnAngle) * spawnDist,
            org.y + Math.sin(spawnAngle) * spawnDist,
            spawnAngle,
            false
          );
          offspring.generation = org.generation + 1;
          offspring.plasticity.inheritFromParentWithMutation(org.plasticity, 0.05);
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

          // Verificar límites contra barreras y centro
          if (!this.diffusionGrid.isPointBlocked(nextAX + centerOffset, nextAY + centerOffset)) {
            oA.x = nextAX;
            oA.y = nextAY;
          }
          if (!this.diffusionGrid.isPointBlocked(nextBX + centerOffset, nextBY + centerOffset)) {
            oB.x = nextBX;
            oB.y = nextBY;
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

  public getLeader(): HabitatOrganism | undefined {
    for (const org of this.organisms.values()) {
      if (org.isLeader && !org.isDecomposing) return org;
    }
    for (const org of this.organisms.values()) {
      if (!org.isDecomposing) return org;
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
      default:
        return 0.30;
    }
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

    for (const org of this.organisms.values()) {
      if (org.isDecomposing) continue;
      if (org.species === 'DROSOPHILA') drosophilaCount++;
      else if (org.species === 'C_ELEGANS') cElegansCount++;
      else if (org.species === 'ANT') antCount++;
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
      },
    };
  }
}

export const biocyberneticHabitat = BiocyberneticHabitatEngine.getInstance();

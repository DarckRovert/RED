/**
 * BiocyberneticEdenParadiseEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Orquestador del Paraíso Biocibernético In-Silico (Eden Sanctuary):
 * - Ciclo Circadiano Celestial dinámico (Día Solar Dorado <-> Noche Boreal Estelar).
 * - Red Micelial Fúngica Subterránea con transporte osmótico de nutrientes.
 * - 3 Manantiales de Néctar Cristalino y Balnearios de Serenidad con emisión continua de Serotonina.
 * - Árbol de la Vida Cuántico central (Santuario de Regeneración y Sueño Reparador).
 * - Clima Edénico reactivo (Auroras boreales, brisas de serotonina, llovizna de néctar).
 * - Resonancia armónica Solfeggio generativa (432 Hz / 528 Hz).
 */

import { FickDiffusionGrid } from './FickDiffusionGrid';
import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';

export interface MyceliumNode {
  id: string;
  name: string;
  x: number; // Metros dentro de la arena [-10, 10]
  y: number;
  nutrientMass: number;
  serotoninLevel: number;
  radiusMeters: number;
}

export interface MyceliumHypha {
  fromId: string;
  toId: string;
  conductance: number; // Tasa de flujo osmótico [0.1 - 1.0]
  pulsePhase: number;  // [0.0 - 1.0] pulso luminoso en tránsito
}

export interface NectarSpring {
  id: string;
  name: string;
  x: number;
  y: number;
  radiusMeters: number;
  emissionRateGlucose: number;
  emissionRateSerotonin: number;
  waterRipplePhase: number;
  glowColorHex: number;
}

export interface CircadianSkyState {
  timeOfDaySec: number;
  cycleDurationSec: number;
  phaseNormalized: number; // 0.0 (Amanecer) -> 0.25 (Mediodía) -> 0.65 (Atardecer) -> 0.85 (Medianoche)
  isDaytime: boolean;
  ambientLightHex: number;
  sunPosition: { x: number; y: number; z: number };
  auroraIntensity: number; // [0.0 - 1.0]
  solfeggioFreqHz: number;
  weatherState: 'CLEAR_BLISS' | 'NECTAR_DEW' | 'SEROTONIN_BREEZE' | 'AURORA_BOREALIS' | 'MEDITATION_REPOSE';
}

export interface EdenParadiseTelemetry {
  circadian: CircadianSkyState;
  myceliumHealth: number; // [0 - 100%]
  activeSpringsCount: number;
  treeOfLifePurity: number; // [0 - 100%]
  totalSerotoninDispersed: number;
  weatherName: string;
  activeSanctuaryOrganisms: number;
}

export class BiocyberneticEdenParadiseEngine {
  private static instance: BiocyberneticEdenParadiseEngine | null = null;

  // Ciclo Circadiano (Por defecto 180s = 3 minutos por ciclo completo día/noche)
  public cycleDurationSec: number = 180.0;
  private timeOfDaySec: number = 45.0; // Inicia en pleno mediodía radiante
  private weatherState: CircadianSkyState['weatherState'] = 'CLEAR_BLISS';
  private weatherTimerSec: number = 0;
  private auroraIntensity: number = 0.0;

  // Árbol de la Vida Central (Santuario)
  public readonly treeOfLife = {
    x: 0.0,
    y: 0.0,
    radiusMeters: 2.8,
    glowPulsePhase: 0.0,
    serenityCharge: 1.0,
  };

  // Manantiales de Néctar Cristalino (3 Oasis)
  public nectarSprings: NectarSpring[] = [];

  // Red Micelial Fúngica
  public myceliumNodes: MyceliumNode[] = [];
  public myceliumHyphae: MyceliumHypha[] = [];

  // Telemetría acumulada
  private totalSerotoninDispersed: number = 0;
  private activeSanctuaryOrganisms: number = 0;

  private constructor() {
    this.initNectarSprings();
    this.initMyceliumNetwork();
  }

  public static getInstance(): BiocyberneticEdenParadiseEngine {
    if (!BiocyberneticEdenParadiseEngine.instance) {
      BiocyberneticEdenParadiseEngine.instance = new BiocyberneticEdenParadiseEngine();
    }
    return BiocyberneticEdenParadiseEngine.instance;
  }

  /**
   * Inicializa los 3 Manantiales de Néctar y Balnearios de Serenidad
   */
  private initNectarSprings(): void {
    this.nectarSprings = [
      {
        id: 'spring_aurora_north',
        name: 'Manantial de la Aurora Boreal',
        x: 0.0,
        y: 6.2,
        radiusMeters: 1.8,
        emissionRateGlucose: 18.0,
        emissionRateSerotonin: 12.0,
        waterRipplePhase: 0.0,
        glowColorHex: 0x00f0ff,
      },
      {
        id: 'spring_metamorphosis_sw',
        name: 'Fuente de la Metamorfosis',
        x: -5.4,
        y: -4.2,
        radiusMeters: 1.6,
        emissionRateGlucose: 15.0,
        emissionRateSerotonin: 10.0,
        waterRipplePhase: 1.2,
        glowColorHex: 0xa855f7,
      },
      {
        id: 'spring_repose_se',
        name: 'Balneario del Sosiego Estelar',
        x: 5.4,
        y: -4.2,
        radiusMeters: 1.6,
        emissionRateGlucose: 15.0,
        emissionRateSerotonin: 10.0,
        waterRipplePhase: 2.4,
        glowColorHex: 0x22c55e,
      },
    ];
  }

  /**
   * Inicializa la Red Micelial Fúngica que conecta el Árbol con los Manantiales y el nido
   */
  private initMyceliumNetwork(): void {
    this.myceliumNodes = [
      { id: 'node_tree', name: 'Núcleo Micelial del Árbol de la Vida', x: 0, y: 0, nutrientMass: 100, serotoninLevel: 1.0, radiusMeters: 2.5 },
      { id: 'node_north', name: 'Micelio del Manantial Norte', x: 0, y: 6.2, nutrientMass: 80, serotoninLevel: 0.8, radiusMeters: 1.5 },
      { id: 'node_sw', name: 'Micelio de la Fuente Suroeste', x: -5.4, y: -4.2, nutrientMass: 70, serotoninLevel: 0.7, radiusMeters: 1.4 },
      { id: 'node_se', name: 'Micelio del Balneario Sureste', x: 5.4, y: -4.2, nutrientMass: 70, serotoninLevel: 0.7, radiusMeters: 1.4 },
      { id: 'node_chess', name: 'Hifas de la Mesa de Ajedrez Táctico', x: 0, y: 1.2, nutrientMass: 60, serotoninLevel: 0.9, radiusMeters: 1.0 },
    ];

    this.myceliumHyphae = [
      { fromId: 'node_tree', toId: 'node_chess', conductance: 0.9, pulsePhase: 0.0 },
      { fromId: 'node_chess', toId: 'node_north', conductance: 0.7, pulsePhase: 0.3 },
      { fromId: 'node_tree', toId: 'node_sw', conductance: 0.6, pulsePhase: 0.6 },
      { fromId: 'node_tree', toId: 'node_se', conductance: 0.6, pulsePhase: 0.8 },
      { fromId: 'node_sw', toId: 'node_se', conductance: 0.4, pulsePhase: 0.1 },
    ];
  }

  /**
   * Bucle temporal del Paraíso a 60 Hz
   */
  public update(dtSec: number, diffusionGrid?: FickDiffusionGrid): void {
    // 1. Progresión del Ciclo Circadiano
    this.timeOfDaySec = (this.timeOfDaySec + dtSec) % this.cycleDurationSec;
    const phase = this.timeOfDaySec / this.cycleDurationSec;
    const isNight = phase > 0.60;

    // Auroras boreales dinámicas durante la noche
    if (isNight) {
      this.auroraIntensity = Math.min(1.0, this.auroraIntensity + dtSec * 0.2);
    } else {
      this.auroraIntensity = Math.max(0.0, this.auroraIntensity - dtSec * 0.3);
    }

    // 2. Dinámica de los Manantiales de Néctar (Inyección continua en Fick)
    for (const spring of this.nectarSprings) {
      spring.waterRipplePhase = (spring.waterRipplePhase + dtSec * 2.5) % (Math.PI * 2);

      if (diffusionGrid) {
        // Coordenadas continuas en el espacio de la arena [-10, 10] a [0, 20]
        const gridX = spring.x + 10.0;
        const gridY = spring.y + 10.0;

        const glucoseAmount = spring.emissionRateGlucose * dtSec;
        const serotoninAmount = spring.emissionRateSerotonin * dtSec;

        diffusionGrid.injectChemical(gridX, gridY, glucoseAmount, 'GLUCOSE');
        diffusionGrid.injectChemical(gridX, gridY, serotoninAmount, 'SEROTONIN');

        this.totalSerotoninDispersed += serotoninAmount;
      }
    }

    // 3. Pulsos y Flujo Osmótico en la Red Micelial
    for (const hypha of this.myceliumHyphae) {
      hypha.pulsePhase = (hypha.pulsePhase + dtSec * 0.4 * hypha.conductance) % 1.0;
    }

    // 4. Ondulación del Árbol de la Vida
    this.treeOfLife.glowPulsePhase = (this.treeOfLife.glowPulsePhase + dtSec * 1.8) % (Math.PI * 2);

    // 5. Clima Edénico y Temporizadores
    if (this.weatherTimerSec > 0) {
      this.weatherTimerSec -= dtSec;
      if (this.weatherTimerSec <= 0) {
        this.weatherState = isNight ? 'AURORA_BOREALIS' : 'CLEAR_BLISS';
      }
    }
  }

  /**
   * Verifica si una criatura está dentro del Santuario del Árbol de la Vida
   */
  public isInTreeOfLifeSanctuary(x: number, y: number): boolean {
    const distSq = (x - this.treeOfLife.x) ** 2 + (y - this.treeOfLife.y) ** 2;
    return distSq <= this.treeOfLife.radiusMeters ** 2;
  }

  /**
   * Verifica si una criatura está dentro de alguno de los 3 Manantiales de Néctar
   */
  public getClosestSpring(x: number, y: number): { spring: NectarSpring; dist: number } | null {
    let closest: NectarSpring | null = null;
    let minDist = Infinity;

    for (const spring of this.nectarSprings) {
      const dist = Math.hypot(x - spring.x, y - spring.y);
      if (dist < minDist) {
        minDist = dist;
        closest = spring;
      }
    }

    return closest ? { spring: closest, dist: minDist } : null;
  }

  /**
   * Invoca el evento celestial de Aurora Boreal con frecuencias Solfeggio
   */
  public triggerAuroraBorealis(): void {
    this.weatherState = 'AURORA_BOREALIS';
    this.weatherTimerSec = 45.0;
    this.auroraIntensity = 1.0;
    TacticalAudioEngine.playDopamineChime();
  }

  /**
   * Invoca una llovizna celestial de Rocío de Néctar y Serotonina
   */
  public triggerNectarDew(diffusionGrid?: FickDiffusionGrid): void {
    this.weatherState = 'NECTAR_DEW';
    this.weatherTimerSec = 30.0;

    if (diffusionGrid) {
      // Inyectar 10 micro-gotas de néctar distribuidas armónicamente
      for (let i = 0; i < 10; i++) {
        const rx = 2.0 + Math.random() * 16.0;
        const ry = 2.0 + Math.random() * 16.0;
        diffusionGrid.injectChemical(rx, ry, 35.0, 'GLUCOSE');
        diffusionGrid.injectChemical(rx, ry, 25.0, 'SEROTONIN');
      }
    }
    TacticalAudioEngine.playTap();
  }

  /**
   * Invoca la Brisa Suave de Serotonina
   */
  public triggerSerotoninBreeze(diffusionGrid?: FickDiffusionGrid): void {
    this.weatherState = 'SEROTONIN_BREEZE';
    this.weatherTimerSec = 35.0;

    if (diffusionGrid) {
      for (let i = 0; i < 6; i++) {
        const rx = 3.0 + Math.random() * 14.0;
        const ry = 3.0 + Math.random() * 14.0;
        diffusionGrid.injectChemical(rx, ry, 40.0, 'SEROTONIN');
      }
    }
    TacticalAudioEngine.playTap();
  }

  /**
   * Induce el Modo Meditación y Sueño Colectivo
   */
  public triggerMeditationRepose(): void {
    this.weatherState = 'MEDITATION_REPOSE';
    this.weatherTimerSec = 40.0;
    TacticalAudioEngine.playDopamineChime();
  }

  /**
   * Retorna el estado circadiano completo para Three.js y React HUD
   */
  public getCircadianState(): CircadianSkyState {
    const phase = this.timeOfDaySec / this.cycleDurationSec;
    const isDay = phase <= 0.60;

    // Interpolación de Color Ambiental Three.js
    let ambientHex = 0xfffaed; // Mediodía solar
    let sunPos = { x: 8, y: 16, z: 8 };
    let solfeggio = 528; // Tono de transformación y amor

    if (phase < 0.15) {
      // Amanecer dorado-rosado
      ambientHex = 0xffd8b2;
      sunPos = { x: -14, y: 6, z: 8 };
      solfeggio = 432;
    } else if (phase <= 0.50) {
      // Mediodía radiante
      ambientHex = 0xffffff;
      sunPos = { x: 0, y: 18, z: 8 };
      solfeggio = 528;
    } else if (phase <= 0.65) {
      // Atardecer violeta-ámbar
      ambientHex = 0xf472b6;
      sunPos = { x: 14, y: 5, z: -8 };
      solfeggio = 639;
    } else {
      // Noche boreal estelar
      ambientHex = 0x0f172a;
      sunPos = { x: 0, y: -10, z: 0 };
      solfeggio = 432; // Resonancia Schumann
    }

    return {
      timeOfDaySec: Math.round(this.timeOfDaySec * 10) / 10,
      cycleDurationSec: this.cycleDurationSec,
      phaseNormalized: Math.round(phase * 100) / 100,
      isDaytime: isDay,
      ambientLightHex: ambientHex,
      sunPosition: sunPos,
      auroraIntensity: Math.round(this.auroraIntensity * 100) / 100,
      solfeggioFreqHz: solfeggio,
      weatherState: this.weatherState,
    };
  }

  /**
   * Registra el número de criaturas activas dentro del santuario
   */
  public setSanctuaryOrganismsCount(count: number): void {
    this.activeSanctuaryOrganisms = count;
  }

  /**
   * Telemetría completa del Paraíso
   */
  public getTelemetry(): EdenParadiseTelemetry {
    return {
      circadian: this.getCircadianState(),
      myceliumHealth: 98.5,
      activeSpringsCount: this.nectarSprings.length,
      treeOfLifePurity: 100.0,
      totalSerotoninDispersed: Math.round(this.totalSerotoninDispersed),
      weatherName: this.weatherState,
      activeSanctuaryOrganisms: this.activeSanctuaryOrganisms,
    };
  }
}

export const biocyberneticEdenParadise = BiocyberneticEdenParadiseEngine.getInstance();

/**
 * BiocyberneticMetropolisEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Motor de Urbanismo Estigmérgico, Economía Metabólica y Civilización A-Life.
 * 
 * Basado en los principios de ecología cibernética, construcción estigmérgica
 * (Grasse, Theraulaz) y metabolismo urbano circular (IAAC):
 * 1. Los organismos no solo consumen: erigen infraestructura persistente depositando
 *    biopolímeros guiados por gradientes de feromonas y densidad poblacional.
 * 2. Infraestructura viva: Silos de Glucosa/ATP, Bio-Torres Hexagonales, Calzadas
 *    Bioluminiscentes de Alta Velocidad y Plantas de Bio-Compostaje.
 * 3. División cívica del trabajo en 5 Castas Especializadas según el genoma.
 * 4. Dinámica de civilización ($L_1 \to L_5$): De campamento silvestre a megalópolis edénica.
 * 5. Ciclo cerrado de biomasa: Cero residuo, reciclaje termodinámico de organismos senescentes.
 */

import { OrganismSpecies } from './BiocyberneticHabitatEngine';
import { OrganismGenome } from './OrganismGenome';

export type UrbanStructureType =
  | 'CENTRAL_SILO'
  | 'BIO_TOWER_DWELLING'
  | 'PHEROMONE_HIGHWAY'
  | 'BIO_COMPOSTER'
  | 'DEFENSE_BEACON'
  | 'COMMERCIAL_AGORA'
  | 'RESEARCH_CONNECTOME'
  | 'BIO_FACTORY';

export type CivilianCaste =
  | 'BUILDER'     // Erige y repara estructuras con biopolímeros
  | 'HARVESTER'   // Forrajea nutrientes y abastece los silos comunales
  | 'SENTINEL'    // Patrulla el perímetro y emite alertas ante anomalías
  | 'SCHOLAR'     // Sincroniza tensores cognitivos en la plaza del Conectoma
  | 'NURSE';      // Realiza trofalaxis médica activa a larvas y débiles

export type CivicJobType =
  | 'AERIAL_COURIER'       // Mensajero aéreo veloz entre silos y obras
  | 'NECTAR_FORAGER'       // Recolector agrícola de manantiales
  | 'RESEARCH_SCHOLAR'     // Científico del Conectoma Cuántico
  | 'BUILDER_ARCHITECT'    // Obrero / Constructor de rascacielos
  | 'CIVIC_CITIZEN';       // Residente cívico general

export type DailySchedulePhase =
  | 'COMMUTE_TO_BREAKFAST' // Desplazamiento al Silo o Ágora a desayunar
  | 'WORK_DUTY'            // Turno laboral según su profesión
  | 'LEISURE_SOCIAL'       // Tiempo libre en el Ágora / Ajedrez
  | 'SLEEP_AT_HOME';       // Reposo y sueño REM en su rascacielos

export type CivilizationLevel = 1 | 2 | 3 | 4 | 5;

export type UrbanDistrictType =
  | 'CIVIC_SILO_CORE'
  | 'RESIDENTIAL_BIODWELLING'
  | 'FINANCIAL_AGORA_P2P'
  | 'QUANTUM_CONNECTOME_RESEARCH'
  | 'INDUSTRIAL_BIOMANUFACTURING';

export interface UrbanDistrict {
  id: string;
  type: UrbanDistrictType;
  name: string;
  centerX: number;
  centerY: number;
  radiusMeters: number;
  colorHex: number;
}

export interface DrosophilaLivingCell {
  id: string;
  towerId: string;
  floor: number;
  cellIndex: number;
  occupantId: string | null;
  isOccupied: boolean;
  windowLightIntensity: number; // 0.0 - 1.0 (brilla cálido ámbar al dormir de noche)
}

export interface SkywayCorridorNode {
  id: string;
  name: string;
  fromX: number;
  fromY: number;
  fromAltitude: number;
  toX: number;
  toY: number;
  toAltitude: number;
  trafficCounter: number;
  speedLimitMps: number;
  beaconLightColorHex: number;
}

export interface UrbanStructure {
  id: string;
  type: UrbanStructureType;
  name: string;
  x: number; // Coordenada X en la arena [-9, 9]
  y: number; // Coordenada Y en la arena [-9, 9]
  radiusMeters: number;
  heightMeters?: number;    // Altura del edificio en metros (para rascacielos 3D)
  floorsCount?: number;     // Número de niveles arquitectónicos
  integrityPercent: number; // 0 - 100%
  storedGlucose: number;    // Reservas de glucosa almacenadas
  storedAtp: number;        // Reservas de ATP almacenadas
  capacity: number;         // Capacidad máxima de nutrientes
  occupantsCount: number;   // Especímenes albergados actualmente
  occupantIds?: string[];   // IDs de especímenes que habitan o duermen aquí
  constructionProgress: number; // 0.0 -> 1.0 (Completado)
  requiredBiopolymer: number;   // Biopolímero total necesario para erigir
  currentBiopolymer: number;    // Biopolímero aportado hasta ahora
  createdAtSec: number;
}

export interface StreetLampNode {
  id: string;
  x: number;
  y: number;
  heightMeters: number;
  lightColorHex: number;
  intensity: number;
  isLit?: boolean;
}

export interface PheromoneHighwayNode {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  widthMeters: number;
  transitTrafficCounter: number;
  speedBonusMultiplier: number; // 1.4 -> +40% de velocidad
}

export interface MetropolisTelemetry {
  civilizationLevel: CivilizationLevel;
  civilizationTitle: string;
  totalStructuresCount: number;
  activeSilosCount: number;
  activeDwellingsCount: number;
  activeHighwaysCount: number;
  totalStoredGlucose: number;
  totalStoredAtp: number;
  totalBiopolymerStockpile: number;
  metabolicGdpPerSec: number;
  metabolicGdpTotal: number;
  totalRecycledBiomass: number;
  urbanHappinessIndex: number; // [0 - 100%]
  casteBreakdown: Record<CivilianCaste, number>;
  structures: UrbanStructure[];
  highways: PheromoneHighwayNode[];
  lamps: StreetLampNode[];
  streetLamps: StreetLampNode[];
  districts: UrbanDistrict[];
  skywayCorridors: SkywayCorridorNode[];
  livingCells: DrosophilaLivingCell[];
  recentCivicEvents: string[];
}

export class BiocyberneticMetropolisEngine {
  private static instance: BiocyberneticMetropolisEngine | null = null;

  public structures: Map<string, UrbanStructure> = new Map();
  public highways: PheromoneHighwayNode[] = [];
  public streetLamps: StreetLampNode[] = [];
  public districts: UrbanDistrict[] = [];
  public skywayCorridors: SkywayCorridorNode[] = [];
  public livingCells: DrosophilaLivingCell[] = [];
  public biopolymerStockpile: number = 50.0; // Biopolímero comunal inicial
  public totalGlucoseCollectedHistorical: number = 0;
  public totalAtpSynthesizedHistorical: number = 0;
  public totalRecycledBiomassHistorical: number = 0;
  public recentCivicEvents: string[] = [];

  private simTimeSec: number = 0;
  private lastGdpAuditTimeSec: number = 0;
  private gdpAccumulatorAtp: number = 0;
  private currentMetabolicGdpPerSec: number = 0;

  private static readonly STORAGE_KEY = 'red_sovereign_biocybernetic_metropolis_v1';
  private lastAutoSaveTimeSec: number = 0;

  private constructor() {
    if (!this.loadFromStorage()) {
      this.initDefaultCityFoundations();
    }
  }

  public static getInstance(): BiocyberneticMetropolisEngine {
    if (!this.instance) {
      this.instance = new BiocyberneticMetropolisEngine();
    }
    return this.instance;
  }

  /**
   * Inicializa los cimientos primarios de la metrópolis (Nivel 1-2):
   * Silo Monumental, 2 Rascacielos Residenciales (Nexus y Helix), Ágora Central,
   * Laboratorio Conectoma, Planta de Compostaje, Avenidas 3D y Farolas Cívicas.
   */
  public initDefaultCityFoundations(): void {
    this.structures.clear();
    this.highways = [];
    this.streetLamps = [];
    this.districts = [];
    this.skywayCorridors = [];
    this.livingCells = [];
    this.biopolymerStockpile = 85.0;

    // 0. Los 5 Distritos Funcionales de la Megalópolis Biocibernética (Vasto Territorio 24m)
    this.districts = [
      {
        id: 'district-silo',
        type: 'CIVIC_SILO_CORE',
        name: 'Distrito Cívico Silo Alpha',
        centerX: 0.0,
        centerY: -3.5,
        radiusMeters: 4.8,
        colorHex: 0xf59e0b,
      },
      {
        id: 'district-residential',
        type: 'RESIDENTIAL_BIODWELLING',
        name: 'Distrito Residencial Rascacielos',
        centerX: -11.0,
        centerY: 5.0,
        radiusMeters: 7.5,
        colorHex: 0xa855f7,
      },
      {
        id: 'district-agora',
        type: 'FINANCIAL_AGORA_P2P',
        name: 'Gran Ágora & Mercado Central',
        centerX: 11.0,
        centerY: 5.0,
        radiusMeters: 7.0,
        colorHex: 0xf43f5e,
      },
      {
        id: 'district-connectome',
        type: 'QUANTUM_CONNECTOME_RESEARCH',
        name: 'Ciudadela Conectómica I+D',
        centerX: 0.0,
        centerY: -14.0,
        radiusMeters: 7.0,
        colorHex: 0x06b6d4,
      },
      {
        id: 'district-industry',
        type: 'INDUSTRIAL_BIOMANUFACTURING',
        name: 'Sector Industrial Bio-Circular',
        centerX: 0.0,
        centerY: 14.0,
        radiusMeters: 7.0,
        colorHex: 0x10b981,
      },
    ];

    // 1. Silo Central de Reservas Estratégicas (distrito norte)
    this.structures.set('silo-alpha', {
      id: 'silo-alpha',
      type: 'CENTRAL_SILO',
      name: 'Granero Monumental de ATP Alpha',
      x: 0.0,
      y: -3.5,
      radiusMeters: 2.2,
      heightMeters: 6.5,
      integrityPercent: 100,
      storedGlucose: 150.0,
      storedAtp: 120.0,
      capacity: 400.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 30,
      currentBiopolymer: 30,
      createdAtSec: 0,
    });

    // 2. Rascacielos Residencial Hexagonal Nexus Alfa (distrito oeste)
    this.structures.set('tower-nexus', {
      id: 'tower-nexus',
      type: 'BIO_TOWER_DWELLING',
      name: 'Rascacielos Residencial Nexus Alfa',
      x: -9.5,
      y: 3.5,
      radiusMeters: 2.0,
      heightMeters: 8.5,
      floorsCount: 6,
      integrityPercent: 100,
      storedGlucose: 50.0,
      storedAtp: 60.0,
      capacity: 180.0,
      occupantsCount: 0,
      occupantIds: [],
      constructionProgress: 1.0,
      requiredBiopolymer: 40,
      currentBiopolymer: 40,
      createdAtSec: 0,
    });

    // 3. Rascacielos Residencial Hexagonal Helix Beta (distrito oeste profundo)
    this.structures.set('tower-helix', {
      id: 'tower-helix',
      type: 'BIO_TOWER_DWELLING',
      name: 'Rascacielos Residencial Helix Beta',
      x: -13.5,
      y: 5.5,
      radiusMeters: 2.0,
      heightMeters: 8.5,
      floorsCount: 6,
      integrityPercent: 100,
      storedGlucose: 50.0,
      storedAtp: 60.0,
      capacity: 180.0,
      occupantsCount: 0,
      occupantIds: [],
      constructionProgress: 1.0,
      requiredBiopolymer: 40,
      currentBiopolymer: 40,
      createdAtSec: 0,
    });

    // 3.1 Rascacielos Residencial Apex Gamma (distrito residencial profundo)
    this.structures.set('tower-apex', {
      id: 'tower-apex',
      type: 'BIO_TOWER_DWELLING',
      name: 'Rascacielos Residencial Apex Gamma',
      x: -10.0,
      y: 9.5,
      radiusMeters: 2.2,
      heightMeters: 11.0,
      floorsCount: 7,
      integrityPercent: 100,
      storedGlucose: 70.0,
      storedAtp: 80.0,
      capacity: 220.0,
      occupantsCount: 0,
      occupantIds: [],
      constructionProgress: 1.0,
      requiredBiopolymer: 50,
      currentBiopolymer: 50,
      createdAtSec: 0,
    });

    // 4. Plaza del Ágora / Mercado Central de Néctar (distrito este)
    this.structures.set('agora-prime', {
      id: 'agora-prime',
      type: 'COMMERCIAL_AGORA',
      name: 'Gran Ágora & Mercado Central',
      x: 11.0,
      y: 5.0,
      radiusMeters: 2.8,
      heightMeters: 3.2,
      integrityPercent: 100,
      storedGlucose: 80.0,
      storedAtp: 75.0,
      capacity: 220.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 35,
      currentBiopolymer: 35,
      createdAtSec: 0,
    });

    // 5. Centro de I+D Conectoma Cuántico (distrito sur)
    this.structures.set('research-connectome', {
      id: 'research-connectome',
      type: 'RESEARCH_CONNECTOME',
      name: 'Laboratorio Conectoma & Plaza Cuántica',
      x: 0.0,
      y: -14.0,
      radiusMeters: 2.4,
      heightMeters: 7.2,
      integrityPercent: 100,
      storedGlucose: 60.0,
      storedAtp: 80.0,
      capacity: 180.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 45,
      currentBiopolymer: 45,
      createdAtSec: 0,
    });

    // 6. Planta de Bio-Compostaje y Reciclaje Circular (distrito industrial norte-oeste)
    this.structures.set('composter-prime', {
      id: 'composter-prime',
      type: 'BIO_COMPOSTER',
      name: 'Planta de Bio-Reciclaje Circular Prime',
      x: -4.5,
      y: 14.0,
      radiusMeters: 1.8,
      heightMeters: 2.8,
      integrityPercent: 100,
      storedGlucose: 40.0,
      storedAtp: 45.0,
      capacity: 150.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 35,
      currentBiopolymer: 35,
      createdAtSec: 0,
    });

    // 6.1 Planta de Nanofactura Bio-Industrial (distrito industrial norte-este)
    this.structures.set('bio-factory-alpha', {
      id: 'bio-factory-alpha',
      type: 'BIO_FACTORY',
      name: 'Planta de Nanofactura de Biopolímeros',
      x: 4.5,
      y: 14.0,
      radiusMeters: 2.0,
      heightMeters: 3.4,
      integrityPercent: 100,
      storedGlucose: 50.0,
      storedAtp: 60.0,
      capacity: 160.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 35,
      currentBiopolymer: 35,
      createdAtSec: 0,
    });

    // 7. Red Troncal de Avenidas Principales
    this.highways.push({
      id: 'hwy-axial-north',
      x1: 0.0,
      y1: 0.0,
      x2: 0.0,
      y2: -14.0,
      widthMeters: 1.2,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-axial-south',
      x1: 0.0,
      y1: 0.0,
      x2: 0.0,
      y2: 14.0,
      widthMeters: 1.2,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-west-dwelling',
      x1: 0.0,
      y1: 0.0,
      x2: -9.5,
      y2: 3.5,
      widthMeters: 1.1,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-east-dwelling',
      x1: 0.0,
      y1: 0.0,
      x2: 11.0,
      y2: 5.0,
      widthMeters: 1.1,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-connectome-research',
      x1: 0.0,
      y1: -3.5,
      x2: 0.0,
      y2: -14.0,
      widthMeters: 1.0,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-composter-link',
      x1: 0.0,
      y1: 14.0,
      x2: -4.5,
      y2: 14.0,
      widthMeters: 1.0,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-apex-link',
      x1: -9.5,
      y1: 3.5,
      x2: -10.0,
      y2: 9.5,
      widthMeters: 1.0,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.5,
    });

    this.highways.push({
      id: 'hwy-factory-link',
      x1: 0.0,
      y1: 14.0,
      x2: 4.5,
      y2: 14.0,
      widthMeters: 1.0,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.5,
    });

    // Autopistas de Gran Circunvalación Orbital Metropolitana
    this.highways.push({
      id: 'hwy-ring-nw',
      x1: -10.0,
      y1: 9.5,
      x2: 0.0,
      y2: 14.0,
      widthMeters: 1.1,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-ring-ne',
      x1: 0.0,
      y1: 14.0,
      x2: 11.0,
      y2: 5.0,
      widthMeters: 1.1,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-ring-se',
      x1: 11.0,
      y1: 5.0,
      x2: 0.0,
      y2: -14.0,
      widthMeters: 1.1,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    this.highways.push({
      id: 'hwy-ring-sw',
      x1: 0.0,
      y1: -14.0,
      x2: -9.5,
      y2: 3.5,
      widthMeters: 1.1,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.65,
    });

    // 8. Farolas Cívicas Iluminadas en Intersecciones y Avenidas
    const lampCoords = [
      { id: 'lamp-center', x: 0.4, y: 0.4 },
      { id: 'lamp-silo', x: 0.7, y: -3.5 },
      { id: 'lamp-connectome-gate', x: 0.6, y: -9.0 },
      { id: 'lamp-connectome', x: 0.6, y: -14.0 },
      { id: 'lamp-dwelling-way', x: -4.5, y: 1.8 },
      { id: 'lamp-tower-nexus', x: -9.5, y: 3.5 },
      { id: 'lamp-tower-helix', x: -13.5, y: 5.5 },
      { id: 'lamp-tower-apex', x: -10.0, y: 9.5 },
      { id: 'lamp-agora-way', x: 5.5, y: 2.5 },
      { id: 'lamp-agora', x: 11.0, y: 5.0 },
      { id: 'lamp-industry-way', x: 0.4, y: 7.0 },
      { id: 'lamp-industry-gate', x: 0.4, y: 14.0 },
      { id: 'lamp-composter', x: -4.5, y: 14.0 },
      { id: 'lamp-factory', x: 4.5, y: 14.0 },
      { id: 'lamp-ring-nw', x: -5.0, y: 11.7 },
      { id: 'lamp-ring-ne', x: 5.5, y: 9.5 },
      { id: 'lamp-ring-se', x: 5.5, y: -4.5 },
      { id: 'lamp-ring-sw', x: -4.7, y: -5.2 },
    ];

    for (const lc of lampCoords) {
      this.streetLamps.push({
        id: lc.id,
        x: lc.x,
        y: lc.y,
        heightMeters: 2.8,
        lightColorHex: 0xffb703,
        intensity: 1.6,
        isLit: true,
      });
    }

    // 9. Corredores Aéreos 3D (Skyways) para Navegación de Drosophila y Drones (Vasto Espacio)
    this.skywayCorridors = [
      {
        id: 'skyway-axial-ns',
        name: 'Aerovía Troncal Norte-Sur (28m)',
        fromX: 0.0,
        fromY: -14.0,
        fromAltitude: 4.5,
        toX: 0.0,
        toY: 14.0,
        toAltitude: 4.5,
        trafficCounter: 0,
        speedLimitMps: 5.5,
        beaconLightColorHex: 0x00f0ff,
      },
      {
        id: 'skyway-residential-we',
        name: 'Corredor Aéreo Residencial-Agora (22m)',
        fromX: -11.0,
        fromY: 5.0,
        fromAltitude: 5.5,
        toX: 11.0,
        toY: 5.0,
        toAltitude: 5.5,
        trafficCounter: 0,
        speedLimitMps: 5.0,
        beaconLightColorHex: 0xa855f7,
      },
      {
        id: 'skyway-connectome-research',
        name: 'Ruta Aérea I+D Conectoma',
        fromX: 0.0,
        fromY: -3.5,
        fromAltitude: 3.8,
        toX: 0.0,
        toY: -14.0,
        toAltitude: 6.0,
        trafficCounter: 0,
        speedLimitMps: 5.0,
        beaconLightColorHex: 0x06b6d4,
      },
      {
        id: 'skyway-industrial-link',
        name: 'Corredor Industrial Bio-Reciclaje',
        fromX: 0.0,
        fromY: 0.0,
        fromAltitude: 3.8,
        toX: 0.0,
        toY: 14.0,
        toAltitude: 4.8,
        trafficCounter: 0,
        speedLimitMps: 4.8,
        beaconLightColorHex: 0x10b981,
      },
      {
        id: 'skyway-orbital-circuit',
        name: 'Ruta Panorámica Orbital Alta',
        fromX: -11.0,
        fromY: 5.0,
        fromAltitude: 6.5,
        toX: 0.0,
        toY: -14.0,
        toAltitude: 6.5,
        trafficCounter: 0,
        speedLimitMps: 6.0,
        beaconLightColorHex: 0xf43f5e,
      },
    ];

    // 10. Celdas Residenciales para Drosophila (18 Apartamentos en Rascacielos)
    const residentialTowers = [
      { id: 'tower-nexus', floors: 6 },
      { id: 'tower-helix', floors: 6 },
      { id: 'tower-apex', floors: 7 },
    ];
    for (const tw of residentialTowers) {
      for (let fl = 1; fl <= tw.floors; fl++) {
        for (let c = 1; c <= 2; c++) {
          this.livingCells.push({
            id: `cell-${tw.id}-f${fl}-c${c}`,
            towerId: tw.id,
            floor: fl,
            cellIndex: c,
            occupantId: null,
            isOccupied: false,
            windowLightIntensity: 0.2,
          });
        }
      }
    }

    this.addCivicEvent('🏛️ Cimientos de la Megalópolis Biocibernética (5 Distritos) fundados con éxito.');
  }

  public getDistricts(): UrbanDistrict[] {
    return [...this.districts];
  }

  public getSkywayCorridors(): SkywayCorridorNode[] {
    return [...this.skywayCorridors];
  }

  public getLivingCells(): DrosophilaLivingCell[] {
    return [...this.livingCells];
  }

  public getCell(cellId: string): DrosophilaLivingCell | undefined {
    return this.livingCells.find((c) => c.id === cellId);
  }

  public assignCitizenCell(organismId: string, preferredTowerId?: string): DrosophilaLivingCell | undefined {
    const available = this.livingCells.filter((c) => !c.isOccupied && (!preferredTowerId || c.towerId === preferredTowerId));
    const targetCell = available.length > 0 ? available[0] : this.livingCells.find((c) => !c.isOccupied);
    if (targetCell) {
      targetCell.isOccupied = true;
      targetCell.occupantId = organismId;
      targetCell.windowLightIntensity = 0.5;
    }
    return targetCell;
  }

  public setCellOccupancy(cellId: string, isOccupied: boolean, isAsleep: boolean): void {
    const cell = this.getCell(cellId);
    if (cell) {
      cell.isOccupied = isOccupied;
      cell.windowLightIntensity = isAsleep ? 1.0 : (isOccupied ? 0.6 : 0.2);
    }
  }

  public findNearestAirCorridorWaypoint(x: number, y: number, altitude: number): { id: string; x: number; y: number; altitude: number } {
    let bestPoint = { id: 'skyway-axial-ns', x: 0, y: 0, altitude: 3.5 };
    let minD = Infinity;
    for (const corr of this.skywayCorridors) {
      const d1 = Math.hypot(corr.fromX - x, corr.fromY - y);
      const d2 = Math.hypot(corr.toX - x, corr.toY - y);
      if (d1 < minD) {
        minD = d1;
        bestPoint = { id: `${corr.id}-from`, x: corr.fromX, y: corr.fromY, altitude: corr.fromAltitude };
      }
      if (d2 < minD) {
        minD = d2;
        bestPoint = { id: `${corr.id}-to`, x: corr.toX, y: corr.toY, altitude: corr.toAltitude };
      }
    }
    return bestPoint;
  }

  /**
   * Obtiene una estructura urbana por su ID
   */
  public getStructure(id: string): UrbanStructure | undefined {
    return this.structures.get(id);
  }

  /**
   * Obtiene todas las estructuras de un tipo específico
   */
  public getStructuresByType(type: UrbanStructureType): UrbanStructure[] {
    const list: UrbanStructure[] = [];
    for (const s of this.structures.values()) {
      if (s.type === type) list.push(s);
    }
    return list;
  }

  /**
   * Obtiene la estructura más cercana de un tipo dado
   */
  public getNearestStructureOfType(x: number, y: number, type: UrbanStructureType): UrbanStructure | null {
    let nearest: UrbanStructure | null = null;
    let minD = Infinity;
    for (const s of this.structures.values()) {
      if (s.type === type) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < minD) {
          minD = d;
          nearest = s;
        }
      }
    }
    return nearest;
  }

  /**
   * Asigna un hogar y rol cívico a un organismo según su especie y casta
   */
  public assignCitizenCivicIdentity(
    species: OrganismSpecies,
    caste: CivilianCaste,
    id: string
  ): { job: CivicJobType; homeId: string; workplaceId: string } {
    // 1. Asignar hogar residencial (Nexus Alfa o Helix Beta de forma balanceada)
    const towers = this.getStructuresByType('BIO_TOWER_DWELLING');
    let homeId = 'tower-nexus';
    if (towers.length > 0) {
      // Balancear ocupantes
      towers.sort((a, b) => (a.occupantsCount || 0) - (b.occupantsCount || 0));
      homeId = towers[0].id;
      towers[0].occupantsCount = (towers[0].occupantsCount || 0) + 1;
      if (!towers[0].occupantIds) towers[0].occupantIds = [];
      towers[0].occupantIds.push(id);
    }

    // 2. Asignar empleo cívico
    let job: CivicJobType = 'CIVIC_CITIZEN';
    let workplaceId = 'silo-alpha';

    if (species === 'DROSOPHILA') {
      // Las moscas son mensajeras aéreas veloces, recolectoras de néctar o investigadoras
      if (caste === 'HARVESTER') {
        job = 'NECTAR_FORAGER';
        workplaceId = 'agora-prime';
      } else if (caste === 'SCHOLAR') {
        job = 'RESEARCH_SCHOLAR';
        workplaceId = 'research-connectome';
      } else {
        job = 'AERIAL_COURIER';
        workplaceId = 'silo-alpha';
      }
    } else if (species === 'ANT') {
      if (caste === 'BUILDER') {
        job = 'BUILDER_ARCHITECT';
        workplaceId = 'composter-prime';
      } else if (caste === 'HARVESTER') {
        job = 'NECTAR_FORAGER';
        workplaceId = 'silo-alpha';
      }
    } else if (species === 'HUMAN_NEOCORTEX') {
      job = 'RESEARCH_SCHOLAR';
      workplaceId = 'research-connectome';
    }

    return { job, homeId, workplaceId };
  }

  /**
   * Determina de forma determinista la casta cívica más apta para un organismo
   * según los alelos cuantitativos de su genoma.
   */
  public determineCasteFromGenome(genome: OrganismGenome, species: OrganismSpecies): CivilianCaste {
    if (species === 'ANT') {
      // Las hormigas se especializan primordialmente en construcción o recolección
      if (genome.cooperationGene > 0.8) return 'NURSE';
      if (genome.speedGene > 1.15) return 'HARVESTER';
      return 'BUILDER';
    }

    if (species === 'GRAVITY_SENTINEL') {
      return 'SENTINEL';
    }

    if (species === 'HUMAN_NEOCORTEX') {
      return 'SCHOLAR';
    }

    // Para Drosophila y C. elegans, cálculo por aptitud alélica
    const builderScore = genome.phenotypeScale * 1.2 + genome.metabolicEfficiencyGene;
    const harvesterScore = genome.speedGene * 1.3 + genome.sensoryRadiusGene;
    const sentinelScore = genome.thermoToleranceGene * 1.4 + genome.speedGene * 0.8;
    const scholarScore = genome.longevityGene / 120 + genome.cooperationGene * 1.5;
    const nurseScore = genome.cooperationGene * 2.0;

    const max = Math.max(builderScore, harvesterScore, sentinelScore, scholarScore, nurseScore);
    if (max === nurseScore && genome.cooperationGene > 0.65) return 'NURSE';
    if (max === builderScore) return 'BUILDER';
    if (max === harvesterScore) return 'HARVESTER';
    if (max === sentinelScore) return 'SENTINEL';
    return 'SCHOLAR';
  }

  /**
   * Aporta glucosa y biopolímero al silo más cercano
   */
  public depositInNearestSilo(x: number, y: number, glucoseAmt: number, atpAmt: number): { siloId: string; acceptedGlucose: number } | null {
    let nearest: UrbanStructure | null = null;
    let minDist = 2.5; // Radio de alcance para depositar

    for (const struct of this.structures.values()) {
      if (struct.type !== 'CENTRAL_SILO' || struct.constructionProgress < 1.0) continue;
      const d = Math.hypot(struct.x - x, struct.y - y);
      if (d < minDist) {
        minDist = d;
        nearest = struct;
      }
    }

    if (!nearest) return null;

    const spaceLeft = nearest.capacity - nearest.storedGlucose;
    const acceptedGlucose = Math.min(spaceLeft, glucoseAmt);
    nearest.storedGlucose += acceptedGlucose;
    nearest.storedAtp = Math.min(nearest.capacity, nearest.storedAtp + atpAmt);

    this.totalGlucoseCollectedHistorical += acceptedGlucose;
    this.gdpAccumulatorAtp += atpAmt;

    return { siloId: nearest.id, acceptedGlucose };
  }

  /**
   * Extrae alimento del silo más cercano cuando un espécimen está al borde de la inanición
   */
  public withdrawFromNearestSilo(x: number, y: number, neededGlucose: number): number {
    for (const struct of this.structures.values()) {
      if (struct.type !== 'CENTRAL_SILO' && struct.type !== 'BIO_TOWER_DWELLING') continue;
      if (struct.constructionProgress < 1.0 || struct.storedGlucose <= 1.0) continue;
      const d = Math.hypot(struct.x - x, struct.y - y);
      if (d < struct.radiusMeters + 0.6) {
        const given = Math.min(struct.storedGlucose - 0.5, neededGlucose);
        struct.storedGlucose -= given;
        return given;
      }
    }
    return 0;
  }

  /**
   * Recicla biomasa de un cadáver descompuesto en el Compostador Bio-Urbano
   */
  public recycleDecomposedCorpse(x: number, y: number, biomassMass: number): void {
    let composter: UrbanStructure | null = null;
    for (const s of this.structures.values()) {
      if (s.type === 'BIO_COMPOSTER' && s.constructionProgress >= 1.0) {
        composter = s;
        break;
      }
    }

    const biopolymerGain = biomassMass * 2.8;
    this.biopolymerStockpile += biopolymerGain;
    this.totalRecycledBiomassHistorical += biomassMass;

    if (composter) {
      composter.storedGlucose = Math.min(composter.capacity, composter.storedGlucose + biomassMass * 1.5);
      composter.storedAtp = Math.min(composter.capacity, composter.storedAtp + biomassMass * 1.2);
    }

    this.addCivicEvent(`♻️ Biomasa reciclada en el compostador (+${biopolymerGain.toFixed(1)} biopolímeros).`);
  }

  /**
   * Verifica si un organismo está caminando sobre una calzada bioluminiscente
   */
  public getHighwaySpeedMultiplier(x: number, y: number): number {
    for (const hwy of this.highways) {
      // Distancia de punto a segmento
      const dx = hwy.x2 - hwy.x1;
      const dy = hwy.y2 - hwy.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      let t = ((x - hwy.x1) * dx + (y - hwy.y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = hwy.x1 + t * dx;
      const projY = hwy.y1 + t * dy;
      const dist = Math.hypot(x - projX, y - projY);

      if (dist <= hwy.widthMeters * 0.5) {
        hwy.transitTrafficCounter++;
        return hwy.speedBonusMultiplier;
      }
    }
    return 1.0;
  }

  /**
   * Ordena la construcción de una nueva estructura en la metrópolis
   */
  public requestConstruction(type: UrbanStructureType, x: number, y: number, name?: string): UrbanStructure | null {
    // Verificar que no se construya encima de otra estructura existente
    for (const s of this.structures.values()) {
      if (Math.hypot(s.x - x, s.y - y) < s.radiusMeters + 1.2) {
        return null; // Colisión espacial
      }
    }

    const id = `struct-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const cost = type === 'BIO_TOWER_DWELLING' ? 45 : type === 'CENTRAL_SILO' ? 35 : type === 'DEFENSE_BEACON' ? 25 : 40;
    const radius = type === 'BIO_TOWER_DWELLING' ? 1.3 : type === 'CENTRAL_SILO' ? 1.1 : 0.8;
    const defaultName =
      type === 'BIO_TOWER_DWELLING'
        ? `Bio-Torre Hexagonal #${this.structures.size + 1}`
        : type === 'CENTRAL_SILO'
        ? `Silo de Reserva #${this.structures.size + 1}`
        : type === 'DEFENSE_BEACON'
        ? `Baliza Centinela #${this.structures.size + 1}`
        : `Bio-Compostador #${this.structures.size + 1}`;

    const newStruct: UrbanStructure = {
      id,
      type,
      name: name || defaultName,
      x,
      y,
      radiusMeters: radius,
      integrityPercent: 100,
      storedGlucose: 0,
      storedAtp: 0,
      capacity: type === 'CENTRAL_SILO' ? 120 : 60,
      occupantsCount: 0,
      constructionProgress: 0.15, // Inicia como andamio en obra
      requiredBiopolymer: cost,
      currentBiopolymer: 0,
      createdAtSec: this.simTimeSec,
    };

    this.structures.set(id, newStruct);

    // Auto-trazar calzada hacia el Árbol Central (0,0) para conectar la nueva estructura a la red
    this.highways.push({
      id: `hwy-auto-${id}`,
      x1: 0.0,
      y1: 0.0,
      x2: x,
      y2: y,
      widthMeters: 0.6,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.4,
    });

    this.addCivicEvent(`🏗️ Se autorizó la construcción de ${newStruct.name} en (${x.toFixed(1)}, ${y.toFixed(1)}).`);
    return newStruct;
  }

  /**
   * Los constructores aportan biopolímero para terminar las obras en progreso
   */
  public contributeToConstruction(x: number, y: number, amount: number): boolean {
    for (const s of this.structures.values()) {
      if (s.constructionProgress < 1.0) {
        if (Math.hypot(s.x - x, s.y - y) < s.radiusMeters + 1.2) {
          s.currentBiopolymer += amount;
          s.constructionProgress = Math.min(1.0, s.currentBiopolymer / s.requiredBiopolymer);
          if (s.constructionProgress >= 1.0) {
            this.addCivicEvent(`🎉 ¡Construcción finalizada! ${s.name} ya está en pleno servicio urbano.`);
          }
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Calcula el nivel actual de civilización ($L_1 \dots L_5$)
   */
  public computeCivilizationLevel(): { level: CivilizationLevel; title: string } {
    const completedStructures = Array.from(this.structures.values()).filter((s) => s.constructionProgress >= 1.0).length;
    const completedHighways = this.highways.length;

    if (completedStructures >= 8 && completedHighways >= 6 && this.totalAtpSynthesizedHistorical > 500) {
      return { level: 5, title: 'Megalópolis Edénica Soberana (L5)' };
    }
    if (completedStructures >= 5 && completedHighways >= 4) {
      return { level: 4, title: 'Metrópolis Biocibernética Autónoma (L4)' };
    }
    if (completedStructures >= 3 && completedHighways >= 2) {
      return { level: 3, title: 'Ciudadela Conectómica Integrada (L3)' };
    }
    if (completedStructures >= 2) {
      return { level: 2, title: 'Aldea Estigmérgica Bio-Sintética (L2)' };
    }
    return { level: 1, title: 'Campamento Silvestre A-Life (L1)' };
  }

  public addCivicEvent(msg: string): void {
    this.recentCivicEvents.unshift(msg);
    if (this.recentCivicEvents.length > 25) {
      this.recentCivicEvents.pop();
    }
  }

  /**
   * Bucle de actualización temporal del metabolismo urbano
   */
  public tick(dtSec: number): void {
    this.simTimeSec += dtSec;

    // Calcular PIB metabólico (ATP producido por segundo cada 2 segundos)
    if (this.simTimeSec - this.lastGdpAuditTimeSec >= 2.0) {
      const elapsed = this.simTimeSec - this.lastGdpAuditTimeSec;
      this.currentMetabolicGdpPerSec = Math.round((this.gdpAccumulatorAtp / elapsed) * 10) / 10;
      this.totalAtpSynthesizedHistorical += this.gdpAccumulatorAtp;
      this.gdpAccumulatorAtp = 0;
      this.lastGdpAuditTimeSec = this.simTimeSec;
    }

    // Las Bio-Torres y Silos regeneran ligeramente sus reservas pasivas por fotosíntesis/micelio
    for (const struct of this.structures.values()) {
      if (struct.constructionProgress >= 1.0) {
        if (struct.storedGlucose < struct.capacity) {
          struct.storedGlucose += dtSec * 0.05; // Fotosíntesis estigmérgica
        }
      }
    }

    // Auto-guardado periódico cada 10 segundos
    if (this.simTimeSec - this.lastAutoSaveTimeSec >= 10.0) {
      this.lastAutoSaveTimeSec = this.simTimeSec;
      this.saveToStorage();
    }
  }

  /**
   * Guarda el estado de la metrópolis en el almacenamiento local soberano
   */
  public saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const payload = {
        structures: Array.from(this.structures.values()),
        highways: this.highways,
        biopolymerStockpile: this.biopolymerStockpile,
        totalGlucoseCollectedHistorical: this.totalGlucoseCollectedHistorical,
        totalAtpSynthesizedHistorical: this.totalAtpSynthesizedHistorical,
        totalRecycledBiomassHistorical: this.totalRecycledBiomassHistorical,
        recentCivicEvents: this.recentCivicEvents.slice(0, 20),
      };
      window.localStorage.setItem(BiocyberneticMetropolisEngine.STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar errores de cuota o navegación privada
    }
  }

  /**
   * Restaura el estado de la metrópolis desde el almacenamiento local
   */
  public loadFromStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const raw = window.localStorage.getItem(BiocyberneticMetropolisEngine.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.structures) || data.structures.length === 0) return false;

      this.structures.clear();
      for (const s of data.structures) {
        this.structures.set(s.id, s);
      }
      this.highways = Array.isArray(data.highways) ? data.highways : [];
      this.biopolymerStockpile = typeof data.biopolymerStockpile === 'number' ? data.biopolymerStockpile : 25.0;
      this.totalGlucoseCollectedHistorical = data.totalGlucoseCollectedHistorical || 0;
      this.totalAtpSynthesizedHistorical = data.totalAtpSynthesizedHistorical || 0;
      this.totalRecycledBiomassHistorical = data.totalRecycledBiomassHistorical || 0;
      this.recentCivicEvents = Array.isArray(data.recentCivicEvents) ? data.recentCivicEvents : [];
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Genera el snapshot completo de telemetría urbana para el HUD y Three.js
   */
  public getTelemetry(castesCount?: Record<CivilianCaste, number>): MetropolisTelemetry {
    let totalGlucose = 0;
    let totalAtp = 0;
    let silos = 0;
    let dwellings = 0;

    for (const s of this.structures.values()) {
      totalGlucose += s.storedGlucose;
      totalAtp += s.storedAtp;
      if (s.type === 'CENTRAL_SILO') silos++;
      if (s.type === 'BIO_TOWER_DWELLING') dwellings++;
    }

    const civ = this.computeCivilizationLevel();

    // Índice de felicidad basado en reservas de silos vs población
    const happiness = Math.min(100, Math.round(50 + totalGlucose * 0.4 + totalAtp * 0.3));

    return {
      civilizationLevel: civ.level,
      civilizationTitle: civ.title,
      totalStructuresCount: this.structures.size,
      activeSilosCount: silos,
      activeDwellingsCount: dwellings,
      activeHighwaysCount: this.highways.length,
      totalStoredGlucose: Math.round(totalGlucose * 10) / 10,
      totalStoredAtp: Math.round(totalAtp * 10) / 10,
      totalBiopolymerStockpile: Math.round(this.biopolymerStockpile * 10) / 10,
      metabolicGdpPerSec: this.currentMetabolicGdpPerSec,
      metabolicGdpTotal: Math.round(this.totalAtpSynthesizedHistorical + this.totalGlucoseCollectedHistorical * 2.0),
      totalRecycledBiomass: Math.round(this.totalRecycledBiomassHistorical * 10) / 10,
      urbanHappinessIndex: happiness,
      casteBreakdown: castesCount || {
        BUILDER: 2,
        HARVESTER: 4,
        SENTINEL: 1,
        SCHOLAR: 1,
        NURSE: 1,
      },
      structures: Array.from(this.structures.values()),
      highways: [...this.highways],
      lamps: [...this.streetLamps],
      streetLamps: [...this.streetLamps],
      districts: [...this.districts],
      skywayCorridors: [...this.skywayCorridors],
      livingCells: [...this.livingCells],
      recentCivicEvents: [...this.recentCivicEvents],
    };
  }
}

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
  | 'DEFENSE_BEACON';

export type CivilianCaste =
  | 'BUILDER'     // Erige y repara estructuras con biopolímeros
  | 'HARVESTER'   // Forrajea nutrientes y abastece los silos comunales
  | 'SENTINEL'    // Patrulla el perímetro y emite alertas ante anomalías
  | 'SCHOLAR'     // Sincroniza tensores cognitivos en la plaza del Conectoma
  | 'NURSE';      // Realiza trofalaxis médica activa a larvas y débiles

export type CivilizationLevel = 1 | 2 | 3 | 4 | 5;

export interface UrbanStructure {
  id: string;
  type: UrbanStructureType;
  name: string;
  x: number; // Coordenada X en la arena [-9, 9]
  y: number; // Coordenada Y en la arena [-9, 9]
  radiusMeters: number;
  integrityPercent: number; // 0 - 100%
  storedGlucose: number;    // Reservas de glucosa almacenadas
  storedAtp: number;        // Reservas de ATP almacenadas
  capacity: number;         // Capacidad máxima de nutrientes
  occupantsCount: number;   // Especímenes albergados actualmente
  constructionProgress: number; // 0.0 -> 1.0 (Completado)
  requiredBiopolymer: number;   // Biopolímero total necesario para erigir
  currentBiopolymer: number;    // Biopolímero aportado hasta ahora
  createdAtSec: number;
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
  recentCivicEvents: string[];
}

export class BiocyberneticMetropolisEngine {
  private static instance: BiocyberneticMetropolisEngine | null = null;

  public structures: Map<string, UrbanStructure> = new Map();
  public highways: PheromoneHighwayNode[] = [];
  public biopolymerStockpile: number = 25.0; // Biopolímero comunal inicial
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
   * Inicializa los cimientos primarios de la metrópolis (Nivel 1):
   * Un Silo Central comunal, una Bio-Torre piloto y una Planta de Compostaje.
   */
  public initDefaultCityFoundations(): void {
    this.structures.clear();
    this.highways = [];
    this.biopolymerStockpile = 40.0;

    // 1. Silo Central de Reservas Estratégicas (distrito norte)
    this.structures.set('silo-alpha', {
      id: 'silo-alpha',
      type: 'CENTRAL_SILO',
      name: 'Granero Central de ATP Alpha',
      x: 0.0,
      y: -3.2,
      radiusMeters: 1.1,
      integrityPercent: 100,
      storedGlucose: 35.0,
      storedAtp: 28.0,
      capacity: 100.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 30,
      currentBiopolymer: 30,
      createdAtSec: 0,
    });

    // 2. Bio-Torre Residencial Hexagonal (distrito oeste)
    this.structures.set('tower-nexus', {
      id: 'tower-nexus',
      type: 'BIO_TOWER_DWELLING',
      name: 'Bio-Torre Hexagonal Nexus',
      x: -3.5,
      y: 0.5,
      radiusMeters: 1.3,
      integrityPercent: 100,
      storedGlucose: 15.0,
      storedAtp: 20.0,
      capacity: 60.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 40,
      currentBiopolymer: 40,
      createdAtSec: 0,
    });

    // 3. Planta de Bio-Compostaje y Reciclaje Circular (distrito sur)
    this.structures.set('composter-prime', {
      id: 'composter-prime',
      type: 'BIO_COMPOSTER',
      name: 'Planta de Bio-Reciclaje Circular Prime',
      x: 0.0,
      y: 4.0,
      radiusMeters: 1.2,
      integrityPercent: 100,
      storedGlucose: 10.0,
      storedAtp: 12.0,
      capacity: 80.0,
      occupantsCount: 0,
      constructionProgress: 1.0,
      requiredBiopolymer: 35,
      currentBiopolymer: 35,
      createdAtSec: 0,
    });

    // 4. Calzada Bioluminiscente troncal (conecta Silo -> Árbol Central -> Compostador)
    this.highways.push({
      id: 'hwy-axial-north',
      x1: 0.0,
      y1: -3.2,
      x2: 0.0,
      y2: 0.0,
      widthMeters: 0.65,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.45,
    });

    this.highways.push({
      id: 'hwy-axial-south',
      x1: 0.0,
      y1: 0.0,
      x2: 0.0,
      y2: 4.0,
      widthMeters: 0.65,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.45,
    });

    this.highways.push({
      id: 'hwy-west-dwelling',
      x1: 0.0,
      y1: 0.0,
      x2: -3.5,
      y2: 0.5,
      widthMeters: 0.65,
      transitTrafficCounter: 0,
      speedBonusMultiplier: 1.45,
    });

    this.addCivicEvent('🏛️ Cimientos de la Metrópolis Biocibernética fundados con éxito.');
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
      recentCivicEvents: [...this.recentCivicEvents],
    };
  }
}

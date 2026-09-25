/**
 * OrganismGenome.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Motor de Genética Cuantitativa, Herencia Epigenética y Filogenia A-Life.
 * 
 * Modela el ADN digital de cada organismo del hábitat con alelos continuos
 * sujetos a selección natural darwiniana (trade-offs biofísicos reales):
 * - speedGene: Mayor velocidad implica mayor tasa metabólica basal (Ley de Kleiber).
 * - metabolicEfficiencyGene: Rendimiento enzimático de conversión de glucosa a ATP.
 * - sensoryRadiusGene: Rango espacial de sensilas químicas y omatidios visuales.
 * - longevityGene: Telómeros biológicos; tiempo de senescencia programada.
 * - thermoToleranceGene: Umbral de aversión y resistencia ante estrés térmico e infrarrojo.
 * - cooperationGene: Tendencia a la trofalaxis social y seguimiento de feromonas.
 * - mutationRateGene: Variabilidad estocástica en la replicación celular.
 * - phenotypeScale: Escala física del espécimen [0.75 - 1.35].
 * - phenotypeHueShift: Desviación cromática (-60° a +60°) visible en exoesqueleto y cutícula.
 */

import { OrganismSpecies } from './BiocyberneticHabitatEngine';

export interface AlleleTraits {
  speedGene: number;              // [0.6 - 2.2] Multiplicador de velocidad de locomoción
  metabolicEfficiencyGene: number;// [0.6 - 2.0] Rendimiento de glucosa -> ATP
  sensoryRadiusGene: number;      // [0.5 - 2.5] Factor de alcance de sensores
  longevityGene: number;          // [60 - 360] Segundos de vida máxima antes de senescencia
  thermoToleranceGene: number;    // [0.4 - 1.8] Resistencia al calor y radiación
  cooperationGene: number;        // [0.1 - 1.0] Propensión a trofalaxis / sociabilidad
  mutationRateGene: number;       // [0.02 - 0.15] Factor sigma de mutación
  phenotypeScale: number;         // [0.75 - 1.35] Tamaño morfológico
  phenotypeHueShift: number;      // [-60 - +60] Desviación de color en grados
}

export interface OrganismGenome extends AlleleTraits {
  species: OrganismSpecies;
  generation: number;             // G1, G2, G3...
  lineageId: string;              // Clan ancestral (e.g., "LINEAGE-DROSOPHILA-01")
  parentId?: string;              // ID del progenitor directo
  birthTimestamp: number;         // Timestamp del nacimiento (simTimeSec)
  mutationsCount: number;         // Total de mutaciones acumuladas desde el ancestro
  mutationsLog: string[];         // Historial textual de variaciones fenotípicas
}

export interface EvolutionChronicleEntry {
  id: string;
  timestampSec: number;
  type: 'BIRTH' | 'MITOSIS' | 'MUTATION_BREAKTHROUGH' | 'SENESCENCE' | 'STARVATION' | 'EXTINCTION' | 'TROPHALLAXIS';
  species: OrganismSpecies;
  organismId: string;
  generation: number;
  lineageId: string;
  headline: string;
  detail: string;
}

export interface PopulationGeneticsTelemetry {
  totalBirths: number;
  totalDeaths: number;
  maxGeneration: number;
  activeLineagesCount: number;
  meanSpeedGene: number;
  meanMetabolicEfficiency: number;
  meanSensoryRadius: number;
  meanLongevitySec: number;
  meanCooperationGene: number;
  topLineageId: string;
}

/**
 * Genera un número aleatorio con distribución normal aproximada (Box-Muller)
 */
function randomGaussian(mean: number = 0, stdDev: number = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

/**
 * Limita un valor a un rango cerrado [min, max]
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Crea un genoma basal canónico (Generación 1) adaptado a la especie
 */
export function createInitialGenome(species: OrganismSpecies, lineageIndex: number = 1): OrganismGenome {
  const lineageId = `LIN-${species.slice(0, 4)}-${lineageIndex.toString().padStart(2, '0')}`;
  
  // Alelos basales con ligera variación natural interindividual
  const speedBase = species === 'DROSOPHILA' ? 1.1 : species === 'ANT' ? 1.0 : species === 'C_ELEGANS' ? 0.75 : 1.2;
  const longevityBase = species === 'C_ELEGANS' ? 240 : species === 'ANT' ? 300 : 180;
  const coopBase = species === 'ANT' ? 0.85 : species === 'HUMAN_NEOCORTEX' ? 0.9 : 0.4;

  return {
    species,
    generation: 1,
    lineageId,
    birthTimestamp: 0,
    mutationsCount: 0,
    mutationsLog: ['Genoma fundador ancestral silvestre (G1)'],

    speedGene: clamp(speedBase + (Math.random() - 0.5) * 0.1, 0.6, 2.2),
    metabolicEfficiencyGene: clamp(1.0 + (Math.random() - 0.5) * 0.1, 0.6, 2.0),
    sensoryRadiusGene: clamp(1.0 + (Math.random() - 0.5) * 0.1, 0.5, 2.5),
    longevityGene: clamp(longevityBase + (Math.random() - 0.5) * 20, 60, 360),
    thermoToleranceGene: clamp(1.0 + (Math.random() - 0.5) * 0.1, 0.4, 1.8),
    cooperationGene: clamp(coopBase + (Math.random() - 0.5) * 0.1, 0.1, 1.0),
    mutationRateGene: 0.06,
    phenotypeScale: 1.0,
    phenotypeHueShift: 0,
  };
}

/**
 * Hereda el genoma del progenitor aplicando recombinación asexual con mutación gaussiana
 */
export function inheritGenomeWithMutation(
  parentGenome: OrganismGenome,
  parentId: string,
  currentSimTimeSec: number,
  environmentalStressMultiplier: number = 1.0
): { childGenome: OrganismGenome; mutationHighlights: string[] } {
  const sigma = parentGenome.mutationRateGene * environmentalStressMultiplier;
  const mutationHighlights: string[] = [];

  // 1. Mutar velocidad (Trade-off: +velocidad reduce sutilmente la longevidad)
  const dSpeed = randomGaussian(0, sigma * 0.7);
  const newSpeed = clamp(parentGenome.speedGene + dSpeed, 0.6, 2.2);
  if (Math.abs(dSpeed) > 0.08) {
    const sign = dSpeed > 0 ? '+' : '';
    mutationHighlights.push(`Velocidad ${sign}${Math.round(dSpeed * 100)}%`);
  }

  // 2. Mutar eficiencia metabólica
  const dMeta = randomGaussian(0, sigma * 0.6);
  const newMeta = clamp(parentGenome.metabolicEfficiencyGene + dMeta, 0.6, 2.0);
  if (Math.abs(dMeta) > 0.08) {
    const sign = dMeta > 0 ? '+' : '';
    mutationHighlights.push(`Metabolismo ${sign}${Math.round(dMeta * 100)}%`);
  }

  // 3. Mutar radio sensorial (sensilas y omatidios)
  const dSensory = randomGaussian(0, sigma * 0.8);
  const newSensory = clamp(parentGenome.sensoryRadiusGene + dSensory, 0.5, 2.5);
  if (Math.abs(dSensory) > 0.09) {
    const sign = dSensory > 0 ? '+' : '';
    mutationHighlights.push(`Radio Sensorial ${sign}${Math.round(dSensory * 100)}%`);
  }

  // 4. Mutar longevidad celular
  const dLongevity = randomGaussian(0, sigma * 25);
  const newLongevity = clamp(parentGenome.longevityGene + dLongevity, 60, 360);
  if (Math.abs(dLongevity) > 15) {
    const sign = dLongevity > 0 ? '+' : '';
    mutationHighlights.push(`Telómeros ${sign}${Math.round(dLongevity)}s`);
  }

  // 5. Mutar tolerancia térmica
  const dThermo = randomGaussian(0, sigma * 0.5);
  const newThermo = clamp(parentGenome.thermoToleranceGene + dThermo, 0.4, 1.8);

  // 6. Mutar cooperación / sociabilidad
  const dCoop = randomGaussian(0, sigma * 0.4);
  const newCoop = clamp(parentGenome.cooperationGene + dCoop, 0.1, 1.0);

  // 7. Mutación de tasa mutagénica (evolución de la evolvabilidad)
  const dMutRate = randomGaussian(0, 0.005);
  const newMutRate = clamp(parentGenome.mutationRateGene + dMutRate, 0.02, 0.15);

  // 8. Expresión fenotípica visible (morfología y color)
  const dScale = randomGaussian(0, sigma * 0.3);
  const newScale = clamp(parentGenome.phenotypeScale + dScale, 0.75, 1.35);

  const dHue = randomGaussian(0, sigma * 40);
  const newHue = clamp(parentGenome.phenotypeHueShift + dHue, -60, 60);

  const newGeneration = parentGenome.generation + 1;
  const childMutationsCount = parentGenome.mutationsCount + mutationHighlights.length;

  const summary = mutationHighlights.length > 0
    ? `G${newGeneration}: ${mutationHighlights.join(', ')}`
    : `G${newGeneration}: Réplica conservadora estable`;

  const childGenome: OrganismGenome = {
    species: parentGenome.species,
    generation: newGeneration,
    lineageId: parentGenome.lineageId,
    parentId,
    birthTimestamp: currentSimTimeSec,
    mutationsCount: childMutationsCount,
    mutationsLog: [summary, ...parentGenome.mutationsLog.slice(0, 5)],

    speedGene: newSpeed,
    metabolicEfficiencyGene: newMeta,
    sensoryRadiusGene: newSensory,
    longevityGene: newLongevity,
    thermoToleranceGene: newThermo,
    cooperationGene: newCoop,
    mutationRateGene: newMutRate,
    phenotypeScale: newScale,
    phenotypeHueShift: newHue,
  };

  return { childGenome, mutationHighlights };
}

/**
 * Calcula el índice de aptitud biológica darwiniana (Fitness Score)
 */
export function computeFitnessScore(
  genome: OrganismGenome,
  ageSec: number,
  atpIngested: number,
  offspringCount: number
): number {
  // Ponderación de supervivencia (40%), asimilación energética (30%) y fecundidad (30%)
  const longevityFactor = Math.min(2.0, ageSec / 60.0);
  const energyFactor = Math.min(2.0, atpIngested * 0.5);
  const fecundityFactor = offspringCount * 1.5;

  return Math.round((longevityFactor * 25 + energyFactor * 35 + fecundityFactor * 40) * 10) / 10;
}

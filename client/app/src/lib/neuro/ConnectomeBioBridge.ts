/**
 * ConnectomeBioBridge.ts — RED Sovereign Mesh OS
 *
 * Puente Neuro-Sensoriomotor Bidireccional: Cerebro Drosophila ↔ Hábitat Físico.
 *
 * Cierra el lazo sensoriomotor que faltaba entre:
 *   - BiocyberneticHabitatEngine (mundo físico: difusión Fick, sombras looming,
 *     ondas de aire, metabolismo real del organismo)
 *   - ConnectomeEcosystemOrchestrator (cerebro: 12 subsistemas neurofisiológicos
 *     del MaleCNS Drosophila melanogaster)
 *
 * Arquitectura:
 *   MUNDO FÍSICO → injectSensoryStimuli() → MOTORES SENSORIALES DEL CEREBRO
 *   CEREBRO → applyMotorCommands() → POSICIÓN/VELOCIDAD/ESTADO DEL ORGANISMO
 *
 * Llamado desde BiocyberneticHabitatEngine.physicsTick() a 60 Hz para cada
 * organismo líder (isLeader = true).
 */

import { johnstonOrgan } from './JohnstonOrganEngine';
import { opticLobe } from './OpticLobeEngine';
import { metabolicGovernor } from './MetabolicNeuromorphicGovernor';
import { connectomeOrchestrator, EcosystemConnectomeSnapshot } from './ConnectomeEcosystemOrchestrator';
import { ringAttractor } from './RingAttractorEngine';
import type { HabitatOrganism } from './habitat/BiocyberneticHabitatEngine';

// ─── Constantes de Calibración Bio-Física ─────────────────────────────────────

/** Distancia en metros a la que una sombra looming activa la amenaza visual LC4 */
const LOOMING_THREAT_RADIUS_M = 1.8;

/** Intensidad mínima de air-puff (0-1) para disparar choque JO */
const AIR_PUFF_SHOCK_THRESHOLD = 0.28;

/** Factor de conversión: Hz de CPG → m/s de marcha trípode en la arena de 20m */
const CPG_HZ_TO_MPS = 0.12;

/** Velocidad máxima de escape Giant Fiber (m/s) en la arena de 20m */
const ESCAPE_SPEED_MPS = 3.6;

/** Velocidad de giro máxima por tick (rad) — suavizado de heading */
const MAX_HEADING_TURN_RAD_PER_TICK = 0.18; // ~10° por tick a 60 Hz

/** Tasa de actualización del bridge al cerebro (evita saturar listeners) */
const BRIDGE_UPDATE_INTERVAL_MS = 50; // 20 Hz de bridge sensorial

// ─── Estado Interno del Bridge ─────────────────────────────────────────────────

let lastBridgeUpdateMs = 0;
let lastThreatAngleRad: number | null = null;
let activeConnectomeClients = 0;
let isBridgeEnabled = false;

// ─── Función Auxiliar ──────────────────────────────────────────────────────────

/**
 * Normaliza un ángulo al rango [-π, π].
 */
function normalizeAngle(rad: number): number {
  while (rad > Math.PI) rad -= 2 * Math.PI;
  while (rad < -Math.PI) rad += 2 * Math.PI;
  return rad;
}

// ─── API Pública del Bridge ────────────────────────────────────────────────────

/**
 * Inyecta los estímulos físicos del hábitat en los motores sensoriales del cerebro.
 *
 * Debe llamarse desde BiocyberneticHabitatEngine.physicsTick() para el organismo líder.
 * Incluye throttle interno de 20 Hz para no saturar los listeners de los motores.
 *
 * @param leaderOrg - Organismo líder cuyo estado físico se trasladará al cerebro.
 * @param glucoseConc - Concentración de glucosa bajo los pies del organismo [0-∞]
 * @param alarmConc - Concentración de feromona de alarma bajo los pies [0-∞]
 * @param nearestShadowDistM - Distancia al proyector de sombra looming más cercano (m)
 * @param nearestAirPuffIntensity - Intensidad de la onda de air-puff más cercana [0-1]
 * @param chemicalGradientDelta - Diferencia química entre antenas para tropotaxis
 * @param threatAngleRad - Ángulo hacia la fuente de amenaza looming (para evasión direccional)
 */
export function injectSensoryStimuli(
  leaderOrg: HabitatOrganism,
  glucoseConc: number,
  alarmConc: number,
  nearestShadowDistM: number,
  nearestAirPuffIntensity: number,
  chemicalGradientDelta: number = 0,
  threatAngleRad?: number
): void {
  if (!isBridgeEnabled) return;
  if (typeof threatAngleRad === 'number' && Number.isFinite(threatAngleRad)) {
    lastThreatAngleRad = threatAngleRad;
  }
  const now = Date.now();
  if (now - lastBridgeUpdateMs < BRIDGE_UPDATE_INTERVAL_MS) return;
  lastBridgeUpdateMs = now;

  // 1. Olfato / Quimiorrecepción → JohnstonOrgan (vías JO-CE / antennal lobe)
  //    La concentración de glucosa eleva la resonancia JO-CE de baja frecuencia.
  //    La feromona de alarma sube la energía acústica y dispara el umbral de choque.
  johnstonOrgan.updateChemicalInput(glucoseConc, alarmConc);

  // Quimiotaxis activa: viraje angular inducido por asimetría antenal
  if (glucoseConc > 0.01 && Math.abs(chemicalGradientDelta) > 0.001) {
    ringAttractor.injectAngularVelocity(chemicalGradientDelta * 35.0);
  }

  // 2. Visión de amenaza looming → OpticLobe (neuronas LC4 / LPLC2)
  //    Una sombra dentro del radio crítico activa el detector de colisión.
  const loomingDetected = nearestShadowDistM < LOOMING_THREAT_RADIUS_M;
  opticLobe.injectLoomingThreat(loomingDetected, nearestShadowDistM);

  // 3. Choque mecánico (air-puff) → JohnstonOrgan (subgrupo JO-AB acústico)
  //    Un golpe de aire fuerte activa el arco reflejo monosináptico.
  if (nearestAirPuffIntensity > AIR_PUFF_SHOCK_THRESHOLD) {
    johnstonOrgan.triggerMechanicalShock(nearestAirPuffIntensity);
  }

  // 4. Estado metabólico del organismo → MetabolicNeuromorphicGovernor (IPC/NPF)
  //    El ATP del organismo físico dicta el régimen energético cerebral.
  const metTel = leaderOrg.metabolism.getTelemetry();
  metabolicGovernor.injectOrganismAtp(metTel.atpLevel, metTel.glucoseLevel * 10.0);
}

/**
 * Aplica las decisiones motoras del cerebro sobre el organismo físico en el hábitat.
 *
 * Lee el snapshot actual del ConnectomeEcosystemOrchestrator y actualiza heading,
 * velocidad y estado de comportamiento del organismo líder.
 *
 * @param org - Organismo líder a controlar.
 * @returns El snapshot del cerebro usado (para que el hábitat lo pueda exponer al HUD).
 */
export function applyMotorCommands(org: HabitatOrganism, isFeeding: boolean = false): EcosystemConnectomeSnapshot {
  const snap = connectomeOrchestrator.getOrganismSnapshot();
  if (!isBridgeEnabled) return snap;

  // 1. Reflejo de escape Giant Fiber — máxima prioridad, anula todo lo demás
  //    Tiempo de respuesta real del GF en Drosophila: < 8 ms.
  //    Salto balístico orientado en dirección opuesta a la fuente de la amenaza looming.
  if (snap.giantFiber.isReflexActive) {
    const baseAngle = lastThreatAngleRad !== null ? lastThreatAngleRad : org.headingRad;
    const escapeDir = baseAngle + Math.PI + (Math.random() - 0.5) * 0.5;
    org.headingRad = normalizeAngle(escapeDir);
    org.speedMps = ESCAPE_SPEED_MPS;
    org.behaviorState = 'ESCAPE_REFLEX';
    lastThreatAngleRad = null;
    return snap;
  }

  // 2. TORPOR metabólico → inmovilidad total
  if (snap.organismState === 'TORPOR') {
    org.speedMps = Math.max(0, org.speedMps - 0.001); // desaceleración gradual
    org.behaviorState = 'TORPOR';
    return snap;
  }

  // 3. Estado de Alimentación: extensión de probóscide y desaceleración en el parche de glucosa
  if (isFeeding) {
    org.speedMps += (0.08 - org.speedMps) * 0.25;
    org.behaviorState = 'FEEDING_GLUCOSE (CONNECTOME)';
    return snap;
  }

  // 4. Heading: la brújula E-PG (Ring Attractor) dicta la dirección de marcha.
  //    Conversión rigurosa de azimut náutico (0°=Norte, 90°=Este) a radianes cartesianos (0=Este, π/2=Norte):
  //    targetRad = π/2 - (headingDeg * π / 180)
  if (typeof snap.compass.headingDeg === 'number' && Number.isFinite(snap.compass.headingDeg)) {
    const targetRad = normalizeAngle(Math.PI / 2 - (snap.compass.headingDeg * Math.PI) / 180);
    const headingErr = normalizeAngle(targetRad - org.headingRad);
    const turnAmount = Math.sign(headingErr) * Math.min(Math.abs(headingErr) * 0.08, MAX_HEADING_TURN_RAD_PER_TICK);
    org.headingRad = normalizeAngle(org.headingRad + turnAmount);
  }

  // 5. Velocidad: el CPG (Central Pattern Generator) dicta la velocidad de marcha.
  //    Se respeta el régimen metabólico: CONSERVATIVE reduce la velocidad al 50%.
  const baseSpeed = snap.cpg.meanFrequencyHz * CPG_HZ_TO_MPS;
  const speedMultiplier = snap.organismState === 'CONSERVING' ? 0.5 : 1.0;
  const targetSpeed = snap.cpg.gaitMode === 'QUIESCENT' ? 0 : baseSpeed * speedMultiplier;

  // Suavizado de velocidad (inertia biológica)
  org.speedMps += (targetSpeed - org.speedMps) * 0.12;

  // 6. Comportamiento: refleja el modo neuronal dominante
  if (snap.mushroomBody.behavioralDrive === 'APPROACH') {
    org.behaviorState = 'CONNECTOME_APPROACH';
  } else if (snap.mushroomBody.behavioralDrive === 'AVOID') {
    org.behaviorState = 'CONNECTOME_AVOID';
  } else {
    org.behaviorState = 'CONNECTOME_DRIVEN';
  }

  return snap;
}

/**
 * Devuelve si el puente bio-sensoriomotor está activo y enlazado al orquestador.
 */
export function isConnectomeActive(): boolean {
  return isBridgeEnabled && connectomeOrchestrator.isOrganismRunning();
}

/**
 * Enlaza un cliente visual/modal al puente y garantiza la vitalidad del orquestador del SO.
 */
export function startConnectome(): void {
  activeConnectomeClients++;
  isBridgeEnabled = true;
  if (!connectomeOrchestrator.isOrganismRunning()) {
    connectomeOrchestrator.start();
  }
}

/**
 * Desacopla el cliente del puente sin destruir el organismo vivo del sistema operativo RED.
 * @param force Si es true, ignora el contador y desacopla inmediatamente.
 */
export function stopConnectome(force = false): void {
  if (activeConnectomeClients > 0 && !force) {
    activeConnectomeClients--;
    if (activeConnectomeClients > 0) return;
  } else if (force) {
    activeConnectomeClients = 0;
  }
  isBridgeEnabled = false;
  lastThreatAngleRad = null;
  // NOTA ARQUITECTÓNICA L9: connectomeOrchestrator es el servicio daemon nuclear del OS
  // (gobierna la brújula biofísica E-PG, enrutador de malla hebbiano, CPG, puente autonómico
  // de hardware y estado metabólico). Desactivar el puente sensoriomotor del hábitat/HUD
  // jamás debe matar el organismo neuro-cibernético del sistema operativo.
}

export const connectomeBioBridge = {
  injectSensoryStimuli,
  applyMotorCommands,
  isConnectomeActive,
  startConnectome,
  stopConnectome,
} as const;

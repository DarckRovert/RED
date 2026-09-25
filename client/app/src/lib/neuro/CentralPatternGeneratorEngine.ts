/**
 * CentralPatternGeneratorEngine.ts — RED Sovereign Mesh OS
 *
 * Motor Central de Generadores de Patrones (CPG) & Marcha Trípode Hexápoda
 * basado en la Médula Nerviosa Ventral (VNC) de Drosophila melanogaster
 * y la arquitectura NeuroMechFly v2 / FlyGym (Lobato-Ríos et al., EPFL / Nature Methods 2024).
 *
 * Fundamento Bio-Cibernético:
 * En artrópodos, los movimientos rítmicos de las patas no son calculados por cinemática inversa
 * en el cerebro central, sino por osciladores no lineales acoplados (CPG) ubicados en los ganglios
 * torácicos (T1, T2, T3).
 *
 * Características del Sistema:
 * 1. Osciladores de Fase Acoplados tipo Kuramoto-Matsuoka para las 6 patas:
 *    - Trípode A: Delantera Izquierda (LF), Media Derecha (RM), Trasera Izquierda (LH)
 *    - Trípode B: Delantera Derecha (RF), Media Izquierda (LM), Trasera Derecha (RH)
 *    - Desfase inter-trípode estricto Delta phi = pi (180°), garantizando estabilidad máxima.
 * 2. Modulación Descendente DNa01 / DNa02 (Fan-Shaped Body):
 *    - DNa01 (giro izquierda): acelera patas derechas y desacelera patas izquierdas.
 *    - DNa02 (giro derecha): acelera patas izquierdas y desacelera patas derechas.
 *    - Giant Fiber System (GFS): salto a frecuencia de escape (8.0 Hz).
 * 3. Arcos Reflejos Locales de Bucle Cerrado (Sensilias Campaniformes / NeuroMechFly v2):
 *    - Reflejo Elevador (Elevator Reflex): sobre-elevación de fémur si choca durante el vuelo.
 *    - Reflejo de Búsqueda (Searching Reflex): extensión tibial si no hay contacto al final del vuelo.
 *    - Reflejo de Carga (Load Stance): retención del apoyo si la pata opuesta no está firme.
 * 4. Cinemática Articular 3-DOF (Coxa, Fémur, Tibia) y Generador de Tramas Binarias (12 Bytes)
 *    para transmisión directa por BLE / UART a relés robóticos físicos ESP32-S3.
 */

import { meshRouter } from '../mesh/meshRouter';
import { AerDomainCode } from '../mesh/meshProtocol';

export type LegIdentifier = 'LF' | 'LM' | 'LH' | 'RF' | 'RM' | 'RH';
export type TripodGroup = 'TRIPOD_A' | 'TRIPOD_B';
export type LocomotionSubPhase = 'STANCE' | 'SWING';
export type LocomotionGaitMode = 'QUIESCENT' | 'WAVE' | 'TETRAPOD' | 'TRIPOD' | 'ESCAPE_SPRINT';

export interface LegJointAngles {
  coxaDeg: number;   // Yaw: protracción (+) / retracción (-) [-30° .. +30°]
  femurDeg: number;  // Pitch: elevación (+) / depresión (-) [-20° .. +45°]
  tibiaDeg: number;  // Pitch: extensión (-) / flexión (+) [+10° .. +90°]
  pwmCoxaUs: number; // [1000 .. 2000] us
  pwmFemurUs: number;// [1000 .. 2000] us
  pwmTibiaUs: number;// [1000 .. 2000] us
}

export interface LegOscillatorState {
  id: LegIdentifier;
  index: number;
  tripod: TripodGroup;
  phaseRad: number;             // [0 .. 2*pi)
  normalizedPhase: number;      // [0.0 .. 1.0)
  subPhase: LocomotionSubPhase;
  isGroundContact: boolean;
  intrinsicFrequencyHz: number;
  joints: LegJointAngles;
  elevatorReflexActive: boolean;
  searchingReflexActive: boolean;
  obstacleContact: boolean;
}

export interface CpgLocomotionTelemetry {
  timestamp: number;
  gaitMode: LocomotionGaitMode;
  meanFrequencyHz: number;
  forwardSpeedNormalized: number; // [0.0 .. 1.0]
  steeringBias: number;           // [-1.0 .. +1.0] (- = izquierda, + = derecha)
  dutyFactor: number;             // [0.4 .. 0.8] (0.5 = trípode ideal)
  tripodCoherenceIndex: number;   // [0.0 .. 1.0] (Kuramoto order parameter R)
  isLocomotionActive: boolean;
  legs: Record<LegIdentifier, LegOscillatorState>;
  totalGaitCycles: number;
  elevatorReflexTriggerCount: number;
  searchingReflexTriggerCount: number;
  hardwareFrameSequence: number;
  lastBinaryFrameHex?: string;
}

export class CentralPatternGeneratorEngine {
  private static instance: CentralPatternGeneratorEngine | null = null;

  // Identificadores fijos de patas
  public static readonly LEG_IDS: readonly LegIdentifier[] = ['LF', 'LM', 'LH', 'RF', 'RM', 'RH'] as const;
  
  // Asignación de Trípodes:
  // Tripod A: LF (0), RM (4), LH (2)
  // Tripod B: LM (1), RF (3), RH (5)
  public static readonly TRIPOD_MAP: Record<LegIdentifier, TripodGroup> = {
    LF: 'TRIPOD_A',
    LM: 'TRIPOD_B',
    LH: 'TRIPOD_A',
    RF: 'TRIPOD_B',
    RM: 'TRIPOD_A',
    RH: 'TRIPOD_B',
  };

  // Parámetros dinámicos
  private isRunning = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private readonly dtSec = 0.02; // 50 Hz (20 ms) paso de integración temporal
  private totalCycles = 0;
  private elevatorTriggerCount = 0;
  private searchingTriggerCount = 0;
  private hwFrameSeq = 0;
  private lastHwFrameHex = '';

  // Variables de control de locomoción
  private forwardSpeed = 0.0;    // [0.0 .. 1.0]
  private steeringBias = 0.0;    // [-1.0 .. +1.0]
  private baseFrequencyHz = 2.0; // 2.0 Hz marcha nominal
  private dutyFactor = 0.5;      // 0.5 para trípode
  private isEmergencyEscape = false;

  // Fases de los osciladores [0..5]
  private phases: number[] = [0, Math.PI, 0, Math.PI, 0, Math.PI]; // Inicializado en trípode anti-fase
  private intrinsicFrequencies: number[] = [2.0, 2.0, 2.0, 2.0, 2.0, 2.0];
  private obstacleSensors: boolean[] = [false, false, false, false, false, false];
  private groundSensors: boolean[] = [true, false, true, false, true, false];

  // Matriz de desfase objetivo Theta (6x6)
  // Regla: Contralaterales = pi, Ipsilaterales adyacentes = pi, Intra-trípode = 0
  private targetPhaseDiffs: number[][] = [];
  // Matriz de acoplamiento w_ij (6x6)
  private couplingWeights: number[][] = [];

  // Suscriptores de telemetría y control de estrangulamiento reactivo (~15 Hz / 66 ms)
  // Preserva integración biológica de 50 Hz en el integrador Kuramoto y erradica sobrecarga de UI
  private listeners: Set<(telem: CpgLocomotionTelemetry) => void> = new Set();
  private static readonly TELEMETRY_THROTTLE_MS = 66;
  private lastNotifyTs = 0;
  private notifyThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.initializeOscillatorMatrices();
  }

  public static getInstance(): CentralPatternGeneratorEngine {
    if (!CentralPatternGeneratorEngine.instance) {
      CentralPatternGeneratorEngine.instance = new CentralPatternGeneratorEngine();
    }
    return CentralPatternGeneratorEngine.instance;
  }

  /**
   * Configura la matriz de conexiones sinápticas del CPG torácico.
   */
  private initializeOscillatorMatrices(): void {
    const N = 6;
    this.targetPhaseDiffs = Array.from({ length: N }, () => new Array(N).fill(0));
    this.couplingWeights = Array.from({ length: N }, () => new Array(N).fill(0));

    // Acoplamientos simétricos:
    // LF (0), LM (1), LH (2), RF (3), RM (4), RH (5)
    const K_contra = 6.0; // Acoplamiento contralateral
    const K_ipsi = 6.0;   // Acoplamiento ipsilateral
    const K_tripod = 4.0; // Refuerzo intra-trípode

    // 1. Contralaterales (anti-fase pi)
    this.setCoupling(0, 3, Math.PI, K_contra); // LF <-> RF
    this.setCoupling(1, 4, Math.PI, K_contra); // LM <-> RM
    this.setCoupling(2, 5, Math.PI, K_contra); // LH <-> RH

    // 2. Ipsilaterales adyacentes (anti-fase pi)
    this.setCoupling(0, 1, Math.PI, K_ipsi);   // LF <-> LM
    this.setCoupling(1, 2, Math.PI, K_ipsi);   // LM <-> LH
    this.setCoupling(3, 4, Math.PI, K_ipsi);   // RF <-> RM
    this.setCoupling(4, 5, Math.PI, K_ipsi);   // RM <-> RH

    // 3. Intra-trípode (en fase 0)
    this.setCoupling(0, 4, 0, K_tripod);       // LF <-> RM
    this.setCoupling(4, 2, 0, K_tripod);       // RM <-> LH
    this.setCoupling(3, 1, 0, K_tripod);       // RF <-> LM
    this.setCoupling(1, 5, 0, K_tripod);       // LM <-> RH
  }

  private setCoupling(i: number, j: number, targetDiff: number, weight: number): void {
    this.targetPhaseDiffs[i][j] = targetDiff;
    this.targetPhaseDiffs[j][i] = -targetDiff;
    this.couplingWeights[i][j] = weight;
    this.couplingWeights[j][i] = weight;
  }

  /**
   * Garantiza que el bucle de integración esté activo si el motor está encendido y hay locomoción activa.
   * Si está en reposo (forwardSpeed <= 0.001 y !isEmergencyEscape), suspende el timer para liberar CPU.
   */
  private syncTimerState(): void {
    if (!this.isRunning) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      return;
    }

    const isLocomotionActive = this.forwardSpeed > 0.001 || this.isEmergencyEscape;
    if (isLocomotionActive) {
      if (!this.timerId) {
        this.timerId = setInterval(() => {
          this.integrationStep(this.dtSec);
        }, this.dtSec * 1000);
      }
    } else {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }
  }

  /**
   * Inicia el bucle de integración temporal a 50 Hz.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.syncTimerState();
    this.notifyListeners(true);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.notifyThrottleTimer) {
      clearTimeout(this.notifyThrottleTimer);
      this.notifyThrottleTimer = null;
    }
  }

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Ajusta la velocidad de avance y el sesgo de timoneo desde el cerebro superior (DNa01/DNa02).
   * @param speed [0.0 .. 1.0] 0 = detenido, 1.0 = velocidad máxima
   * @param turn [-1.0 .. +1.0] -1.0 = giro brusco babor, +1.0 = giro brusco estribor
   */
  public setLocomotionDrive(speed: number, turn: number): void {
    this.forwardSpeed = Math.max(0.0, Math.min(1.0, speed));
    this.steeringBias = Math.max(-1.0, Math.min(1.0, turn));
    this.recomputeFrequencies();
    this.syncTimerState();
    this.notifyListeners(true);
  }

  /**
   * Activa o desactiva la ráfaga de escape de emergencia (Giant Fiber System).
   */
  public setEmergencyEscape(active: boolean): void {
    this.isEmergencyEscape = active;
    this.recomputeFrequencies();
    this.syncTimerState();
    this.notifyListeners(true);
  }

  /**
   * Modula las frecuencias intrínsecas de cada pata en función del timoneo y la velocidad.
   */
  private recomputeFrequencies(): void {
    if (this.forwardSpeed <= 0.001 && !this.isEmergencyEscape) {
      this.intrinsicFrequencies.fill(0.0);
      return;
    }

    if (this.isEmergencyEscape) {
      // Sprint de escape de emergencia biológica (8.0 Hz)
      this.intrinsicFrequencies.fill(8.0);
      this.dutyFactor = 0.45;
      return;
    }

    // Frecuencia base proporcional a la velocidad
    const minFreq = 1.0;
    const maxFreq = 4.0;
    this.baseFrequencyHz = minFreq + this.forwardSpeed * (maxFreq - minFreq);
    this.dutyFactor = 0.5; // Trípode canónico

    // Modulación asimétrica por timoneo (DNa01 / DNa02):
    // Izquierda (turn < 0): patas derechas aceleran, patas izquierdas desaceleran.
    // Derecha (turn > 0): patas izquierdas aceleran, patas derechas desaceleran.
    const leftScale = 1.0 + Math.max(-0.6, Math.min(0.6, this.steeringBias * 0.6));
    const rightScale = 1.0 - Math.max(-0.6, Math.min(0.6, this.steeringBias * 0.6));

    // Patas izquierdas: 0 (LF), 1 (LM), 2 (LH)
    this.intrinsicFrequencies[0] = Math.max(0.2, this.baseFrequencyHz * leftScale);
    this.intrinsicFrequencies[1] = Math.max(0.2, this.baseFrequencyHz * leftScale);
    this.intrinsicFrequencies[2] = Math.max(0.2, this.baseFrequencyHz * leftScale);

    // Patas derechas: 3 (RF), 4 (RM), 5 (RH)
    this.intrinsicFrequencies[3] = Math.max(0.2, this.baseFrequencyHz * rightScale);
    this.intrinsicFrequencies[4] = Math.max(0.2, this.baseFrequencyHz * rightScale);
    this.intrinsicFrequencies[5] = Math.max(0.2, this.baseFrequencyHz * rightScale);
  }

  /**
   * Inyecta una detección de obstáculo mecánico en una pata (Campaniform sensillum).
   */
  public setObstacleContact(leg: LegIdentifier, contact: boolean): void {
    const idx = CentralPatternGeneratorEngine.LEG_IDS.indexOf(leg);
    if (idx !== -1) {
      this.obstacleSensors[idx] = contact;
      if (contact) {
        this.elevatorTriggerCount++;
        // Emitir micro-espiga AER táctica ante evento de colisión mecánica
        try {
          meshRouter.broadcastAerSpike(
            AerDomainCode.PHEROMONE_ALARM,
            idx,
            0x7F // Nivel de choque
          ).catch(() => {});
        } catch {}
      }
      this.notifyListeners(true);
    }
  }

  /**
   * Paso discreto de integración temporal de las ecuaciones diferenciales del CPG.
   */
  public integrationStep(dt: number): void {
    if (this.forwardSpeed <= 0.001 && !this.isEmergencyEscape) {
      // Estado en reposo: no avanzar fase
      return;
    }

    const N = 6;
    const dPhi = new Array(N).fill(0);

    for (let i = 0; i < N; i++) {
      // 1. Término intrínseco: 2 * pi * nu_i
      let rate = 2.0 * Math.PI * this.intrinsicFrequencies[i];

      // 2. Acoplamiento sináptico Kuramoto: sum(w_ij * sin(phi_j - phi_i - theta_ij))
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const w = this.couplingWeights[i][j];
        if (w > 0) {
          const theta = this.targetPhaseDiffs[i][j];
          const phaseDiff = this.phases[j] - this.phases[i] - theta;
          rate += w * Math.sin(phaseDiff);
        }
      }

      // 3. Arcos Reflejos Mecanorreceptores (NeuroMechFly v2):
      // A. Reflejo Elevador: si hay obstáculo en vuelo, retardar fase para librar obstáculo
      const normP = ((this.phases[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
      const isSwing = normP >= this.dutyFactor;

      if (isSwing && this.obstacleSensors[i]) {
        rate -= 15.0; // Freno de fase local
      }

      // B. Reflejo de Búsqueda: si al final de swing no toca suelo, extender fase
      if (normP > 0.92 && !this.groundSensors[i]) {
        this.searchingTriggerCount++;
        rate *= 0.3; // Desacelera para buscar contacto
      }

      dPhi[i] = rate;
    }

    // Actualización de fases (Integrador de Euler acotado en [0, 2*pi))
    for (let i = 0; i < N; i++) {
      this.phases[i] = (this.phases[i] + dPhi[i] * dt) % (2 * Math.PI);
      if (this.phases[i] < 0) this.phases[i] += 2 * Math.PI;

      // Actualizar sensor simulado de contacto de suelo según fase
      const normP = this.phases[i] / (2 * Math.PI);
      this.groundSensors[i] = normP < this.dutyFactor;
    }

    this.totalCycles += dt * this.baseFrequencyHz;
    this.hwFrameSeq = (this.hwFrameSeq + 1) & 0xFF;
    this.notifyListeners(false);
  }

  /**
   * Calcula el parámetro de orden de Kuramoto R para medir la coherencia de la marcha trípode.
   * R = 1.0 representa sincronización trípode perfecta (Tripod A en fase entre sí, Tripod B en fase entre sí,
   * y ambos trípodes desfasados exactamente 180°).
   */
  public computeTripodCoherence(): number {
    // Transformar fases de Trípode B invirtiendo su signo (-e^{i phi_B} = e^{i (phi_B + pi)})
    // Si la marcha trípode es perfecta, e^{i phi_A} y -e^{i phi_B} coincidirán exactamente.
    let sumCos = 0.0;
    let sumSin = 0.0;

    // Trípode A: LF (0), LH (2), RM (4)
    const tripodA = [0, 2, 4];
    for (const idx of tripodA) {
      sumCos += Math.cos(this.phases[idx]);
      sumSin += Math.sin(this.phases[idx]);
    }

    // Trípode B: LM (1), RF (3), RH (5) -> rotados 180°
    const tripodB = [1, 3, 5];
    for (const idx of tripodB) {
      sumCos += Math.cos(this.phases[idx] + Math.PI);
      sumSin += Math.sin(this.phases[idx] + Math.PI);
    }

    const R = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / 6.0;
    return Math.min(1.0, Math.max(0.0, R));
  }

  /**
   * Calcula la cinemática articular 3-DOF para una pata en función de su fase instantánea.
   */
  private computeLegJoints(legIndex: number, phaseRad: number): LegJointAngles {
    const normP = phaseRad / (2 * Math.PI);
    const isStance = normP < this.dutyFactor;
    const isElevator = this.obstacleSensors[legIndex] && !isStance;

    let coxaDeg = 0.0;
    let femurDeg = 0.0;
    let tibiaDeg = 35.0; // Posición base de soporte

    if (isStance) {
      // FASE DE APOYO (STANCE):
      // - Coxa: barrido de protracción a retracción (empuja cuerpo hacia adelante)
      //   normP va de 0 a dutyFactor -> interpola de +25° a -25°
      const stanceProgress = normP / this.dutyFactor; // [0.0 .. 1.0]
      coxaDeg = 25.0 - stanceProgress * 50.0;
      femurDeg = -10.0; // Fémur deprimido para apoyo firme
      tibiaDeg = 40.0;  // Tibia en flexión de soporte
    } else {
      // FASE DE VUELO (SWING):
      // - Coxa: avance rápido de -25° hacia +25°
      const swingProgress = (normP - this.dutyFactor) / (1.0 - this.dutyFactor); // [0.0 .. 1.0]
      coxaDeg = -25.0 + swingProgress * 50.0;

      // - Fémur: arco parabólico de despegue y aterrizaje
      //   Si el reflejo elevador está activo por obstáculo, elevar fémur al máximo (+45°)
      const apexFactor = Math.sin(swingProgress * Math.PI);
      femurDeg = isElevator ? 45.0 : 15.0 + apexFactor * 25.0;
      tibiaDeg = isElevator ? 70.0 : 25.0 + apexFactor * 20.0;
    }

    // Mapeo seguro a pulsos PWM microsegundos (1000us a 2000us, centro 1500us)
    const pwmCoxaUs = Math.round(1500 + (coxaDeg / 30.0) * 500);
    const pwmFemurUs = Math.round(1500 + (femurDeg / 45.0) * 500);
    const pwmTibiaUs = Math.round(1500 + ((tibiaDeg - 50.0) / 40.0) * 500);

    return {
      coxaDeg: Math.round(coxaDeg * 10) / 10,
      femurDeg: Math.round(femurDeg * 10) / 10,
      tibiaDeg: Math.round(tibiaDeg * 10) / 10,
      pwmCoxaUs: Math.max(1000, Math.min(2000, pwmCoxaUs)),
      pwmFemurUs: Math.max(1000, Math.min(2000, pwmFemurUs)),
      pwmTibiaUs: Math.max(1000, Math.min(2000, pwmTibiaUs)),
    };
  }

  /**
   * Genera una trama binaria compacta de 12 bytes para streaming a relés ESP32-S3.
   * Formato: [0xAA, 0x55, seq, legMask, pwmByteLF, pwmByteLM, pwmByteLH, pwmByteRF, pwmByteRM, pwmByteRH, flags, crc8]
   */
  public exportActuatorFrameBinary(): Uint8Array {
    const frame = new Uint8Array(12);
    frame[0] = 0xAA; // Magic Header 1
    frame[1] = 0x55; // Magic Header 2
    frame[2] = this.hwFrameSeq & 0xFF;

    // legMask: bit 0..5 = estado de contacto con el suelo (1 = Stance, 0 = Swing)
    let legMask = 0;
    for (let i = 0; i < 6; i++) {
      if (this.groundSensors[i]) legMask |= (1 << i);
    }
    frame[3] = legMask;

    // Bytes 4 a 9: ciclo de posición de fémur cuantizado a 1 byte [0 .. 255] (1000..2000 us)
    for (let i = 0; i < 6; i++) {
      const joints = this.computeLegJoints(i, this.phases[i]);
      const normPwm = Math.round(((joints.pwmFemurUs - 1000) / 1000) * 255);
      frame[4 + i] = Math.max(0, Math.min(255, normPwm));
    }

    // Byte 10: Flags (Bit 0 = Escape, Bit 1 = Elevator reflex activo)
    let flags = 0;
    if (this.isEmergencyEscape) flags |= 0x01;
    if (this.obstacleSensors.some(Boolean)) flags |= 0x02;
    frame[10] = flags;

    // Byte 11: CRC-8 (Polinomio 0x07)
    frame[11] = this.computeCrc8(frame.subarray(0, 11));

    // Guardar para telemetría
    let hex = '';
    for (let i = 0; i < 12; i++) {
      hex += frame[i].toString(16).padStart(2, '0').toUpperCase() + (i < 11 ? ' ' : '');
    }
    this.lastHwFrameHex = hex;

    return frame;
  }

  /**
   * Cálculo de CRC8 (Polinomio x^8 + x^2 + x + 1 -> 0x07)
   */
  private computeCrc8(data: Uint8Array): number {
    let crc = 0x00;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x80) !== 0) {
          crc = ((crc << 1) ^ 0x07) & 0xFF;
        } else {
          crc = (crc << 1) & 0xFF;
        }
      }
    }
    return crc;
  }

  /**
   * Obtiene la telemetría completa del CPG para el HUD y el orquestador.
   */
  public getTelemetry(): CpgLocomotionTelemetry {
    const legsState: Partial<Record<LegIdentifier, LegOscillatorState>> = {};

    for (let i = 0; i < 6; i++) {
      const id = CentralPatternGeneratorEngine.LEG_IDS[i];
      const phaseRad = this.phases[i];
      const normP = phaseRad / (2 * Math.PI);
      const subPhase: LocomotionSubPhase = normP < this.dutyFactor ? 'STANCE' : 'SWING';
      const joints = this.computeLegJoints(i, phaseRad);

      legsState[id] = {
        id,
        index: i,
        tripod: CentralPatternGeneratorEngine.TRIPOD_MAP[id],
        phaseRad: Math.round(phaseRad * 1000) / 1000,
        normalizedPhase: Math.round(normP * 1000) / 1000,
        subPhase,
        isGroundContact: this.groundSensors[i],
        intrinsicFrequencyHz: Math.round(this.intrinsicFrequencies[i] * 10) / 10,
        joints,
        elevatorReflexActive: this.obstacleSensors[i] && subPhase === 'SWING',
        searchingReflexActive: normP > 0.92 && !this.groundSensors[i],
        obstacleContact: this.obstacleSensors[i],
      };
    }

    let gaitMode: LocomotionGaitMode = 'QUIESCENT';
    if (this.isEmergencyEscape) {
      gaitMode = 'ESCAPE_SPRINT';
    } else if (this.forwardSpeed > 0.001) {
      gaitMode = this.dutyFactor <= 0.55 ? 'TRIPOD' : (this.dutyFactor <= 0.7 ? 'TETRAPOD' : 'WAVE');
    }

    const meanFreq = this.intrinsicFrequencies.reduce((a, b) => a + b, 0) / 6.0;

    return {
      timestamp: Date.now(),
      gaitMode,
      meanFrequencyHz: Math.round(meanFreq * 10) / 10,
      forwardSpeedNormalized: Math.round(this.forwardSpeed * 100) / 100,
      steeringBias: Math.round(this.steeringBias * 100) / 100,
      dutyFactor: this.dutyFactor,
      tripodCoherenceIndex: Math.round(this.computeTripodCoherence() * 1000) / 1000,
      isLocomotionActive: this.forwardSpeed > 0.001 || this.isEmergencyEscape,
      legs: legsState as Record<LegIdentifier, LegOscillatorState>,
      totalGaitCycles: Math.round(this.totalCycles * 10) / 10,
      elevatorReflexTriggerCount: this.elevatorTriggerCount,
      searchingReflexTriggerCount: this.searchingTriggerCount,
      hardwareFrameSequence: this.hwFrameSeq,
      lastBinaryFrameHex: this.lastHwFrameHex || undefined,
    };
  }

  public subscribe(callback: (telem: CpgLocomotionTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(force = false): void {
    if (this.listeners.size === 0) return;

    const now = Date.now();
    const elapsed = now - this.lastNotifyTs;

    if (force || elapsed >= CentralPatternGeneratorEngine.TELEMETRY_THROTTLE_MS) {
      if (this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
      this.lastNotifyTs = now;
      this.dispatchTelemetry();
    } else if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        this.lastNotifyTs = Date.now();
        this.dispatchTelemetry();
      }, CentralPatternGeneratorEngine.TELEMETRY_THROTTLE_MS - elapsed);
    }
  }

  private dispatchTelemetry(): void {
    const telem = this.getTelemetry();
    for (const listener of this.listeners) {
      try {
        listener(telem);
      } catch {}
    }
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    CentralPatternGeneratorEngine.instance = null;
  }
}

export const centralPatternGenerator = CentralPatternGeneratorEngine.getInstance();

/**
 * FanShapedBodyEngine.ts — RED Sovereign Mesh OS
 *
 * Emulación Biofísica del Cuerpo en Abanico (Fan-Shaped Body / FB)
 * del Complejo Central (Central Complex / CX) de Drosophila melanogaster
 * (MaleCNS v1.0, FlyWire Connectome / Princeton Murthy Lab).
 *
 * Fundamento Biológico & Neuroarquitectura:
 * El Fan-Shaped Body (FB) es el centro de computación y memoria espacial vectorial en 3D
 * del cerebro del insecto:
 * 1. 16 Columnas azimutales discretizadas (j = 0..15, abarcando 360° en cuñas de 22.5°).
 * 2. 9 Capas horizontales estratificadas (l = 1..9):
 *    - Capas 1-2: Entradas P-FN desde el Puente Protocerebral (PB) y el Cuerpo Elipsoide (EB / RingAttractor)
 *                 con desfase angular de ±45° para descomponer vectores de velocidad.
 *    - Capas 3-4: Interneuronas inhibidoras locales Δ7 que estabilizan y agudizan la sintonización direccional.
 *    - Capas 5-6: Integración de traslación horizontal (Dead Reckoning inercial PDR).
 *    - Capas 7-8: Integración altimétrica vertical (estrato Z por barómetro hipsobárico ICAO).
 *    - Capa 9:   Neuronas de salida (FBON) que decodifican el ángulo de timoneo (Steering Signal)
 *                 hacia el Vector de Casa (Home Vector) o Vector Objetivo (Goal Vector).
 * 3. Integración de Trayectoria Inercial (Vector Path Integration):
 *    Suma incremental continua en coordenadas cartesianas locales [X=Este, Y=Norte, Z=Altitud]
 *    sin dependencia de GPS ni estaciones base.
 */

import { ringAttractor, RingAttractorTelemetry } from './RingAttractorEngine';
import { pedestrianDeadReckoning, PdrState } from '../sensors/PedestrianDeadReckoningEngine';
import { getBaroHistory } from '../sensors/weatherBarometerEngine';

export interface SpatialVector3D {
  xMeters: number; // Desplazamiento Este (+) / Oeste (-)
  yMeters: number; // Desplazamiento Norte (+) / Sur (-)
  zMeters: number; // Desplazamiento Vertical Arriba (+) / Abajo (-)
}

export interface HomeVectorSolution {
  distanceMeters: number;
  bearingDeg: number;         // Rumbo azimutal hacia casa (0-359°)
  cardinal: string;           // N, NE, E, etc.
  deltaAltitudeMeters: number; // Desnivel relativo respecto al punto de partida
  confidence: number;         // [0.0 - 1.0] basado en concentración poblacional
}

export interface GoalVectorSolution {
  hasTarget: boolean;
  distanceMeters: number;
  bearingDeg: number;
  cardinal: string;
  steeringErrorDeg: number;   // Ángulo de corrección entre rumbo actual y rumbo al objetivo (-180° a +180°)
}

export interface FanShapedBodyTelemetry {
  timestamp: number;
  columnsCount: number;       // 16 columnas
  layersCount: number;        // 9 capas
  columnLayerMatrix: number[]; // Matriz serializada de 16x9 (144 valores normalizados [0.0, 1.0])
  currentPosition: SpatialVector3D;
  totalDistanceTraveledMeters: number;
  homeVector: HomeVectorSolution;
  goalVector: GoalVectorSolution;
  pfnExcitationLeft: number;  // Excitación P-FN desfasada a la izquierda (-45°)
  pfnExcitationRight: number; // Excitación P-FN desfasada a la derecha (+45°)
  delta7InhibitionLevel: number; // Nivel de inhibición recurrente de interneuronas Δ7
  isSensoryLocked: boolean;
}

export class FanShapedBodyEngine {
  private static instance: FanShapedBodyEngine | null = null;

  public static readonly NUM_COLUMNS = 16;
  public static readonly NUM_LAYERS = 9;
  public static readonly TOTAL_COLUMNS_LAYERS = 144; // 16 * 9

  // Matriz de activación neuronal C_{column, layer} (16 x 9)
  private activationMatrix: Float64Array;
  // Ángulos azimutales de las 16 columnas
  private columnAnglesRad: Float64Array;

  // Estado inercial de odometría 3D acumulada
  private posX = 0.0; // Metros Este
  private posY = 0.0; // Metros Norte
  private posZ = 0.0; // Metros Altitud relativa
  private totalDistanceTraveled = 0.0;
  private lastPressureHpa: number | null = null; // Presión barométrica para integración hipsométrica ICAO

  // Vector de Origen / Nido (Home Datum)
  private homeOriginX = 0.0;
  private homeOriginY = 0.0;
  private homeOriginZ = 0.0;
  private homeLocked = false;

  // Vector de Objetivo Táctico (Goal Target)
  private targetX: number | null = null;
  private targetY: number | null = null;
  private targetZ: number | null = null;

  // Estado cinemático del atractor
  private currentHeadingDeg = 0.0;
  private currentHeadingRad = 0.0;
  private pdrUnsub: (() => void) | null = null;
  private compassUnsub: (() => void) | null = null;
  private isTracking = false;

  // Interneuronas bio-inspiradas
  private pfnLeft = 0.0;
  private pfnRight = 0.0;
  private delta7Inhibition = 0.25;

  // Suscriptores reactivos
  private listeners: Set<(telemetry: FanShapedBodyTelemetry) => void> = new Set();

  private constructor() {
    this.activationMatrix = new Float64Array(FanShapedBodyEngine.TOTAL_COLUMNS_LAYERS);
    this.columnAnglesRad = new Float64Array(FanShapedBodyEngine.NUM_COLUMNS);

    for (let col = 0; col < FanShapedBodyEngine.NUM_COLUMNS; col++) {
      this.columnAnglesRad[col] = (2 * Math.PI * col) / FanShapedBodyEngine.NUM_COLUMNS - Math.PI;
    }

    this.recomputeActivationMatrix();
  }

  public static getInstance(): FanShapedBodyEngine {
    if (!FanShapedBodyEngine.instance) {
      FanShapedBodyEngine.instance = new FanShapedBodyEngine();
    }
    return FanShapedBodyEngine.instance;
  }

  /**
   * Inicia el acoplamiento bio-cibernético con RingAttractor, PDR y barómetro.
   */
  public start(): void {
    if (this.isTracking) return;
    this.isTracking = true;

    // 1. Acoplar Brújula E-PG de RingAttractor
    this.compassUnsub = ringAttractor.subscribe((telem: RingAttractorTelemetry) => {
      this.onHeadingUpdated(telem.headingDeg);
    });

    // 2. Inicializar referencia de presión barométrica histórica
    try {
      const history = getBaroHistory();
      if (history.length > 0) {
        this.lastPressureHpa = history[history.length - 1].pressureHpa;
      }
    } catch {}

    // 3. Acoplar Odometría Inercial de Pasos de PDR con Desnivel Hipsométrico Real
    let lastStepCount = 0;
    this.pdrUnsub = pedestrianDeadReckoning.subscribe((pdrState: PdrState) => {
      if (pdrState.totalSteps > lastStepCount) {
        const stepsDelta = pdrState.totalSteps - lastStepCount;
        lastStepCount = pdrState.totalSteps;
        // Asume longitud de zancada promedio derivada de la velocidad o 0.75m
        const stepStride = pdrState.totalSteps > 0 && pdrState.distanceMeters > 0
          ? pdrState.distanceMeters / pdrState.totalSteps
          : 0.75;

        // Calcular variación hipsométrica real desde el barómetro
        let stepDeltaZ = 0.0;
        try {
          const history = getBaroHistory();
          if (history.length > 0) {
            const currentP = history[history.length - 1].pressureHpa;
            if (this.lastPressureHpa !== null && Math.abs(this.lastPressureHpa - currentP) >= 0.05) {
              stepDeltaZ = FanShapedBodyEngine.calculateDeltaAltitudeFromPressure(this.lastPressureHpa, currentP);
              this.lastPressureHpa = currentP;
            } else if (this.lastPressureHpa === null) {
              this.lastPressureHpa = currentP;
            }
          }
        } catch {}

        for (let i = 0; i < stepsDelta; i++) {
          this.integrateStep(stepStride, pdrState.currentHeadingDeg, stepDeltaZ / stepsDelta);
        }
      }
    });

    // Si aún no se fijó Home, se fija la posición actual como origen
    if (!this.homeLocked) {
      this.setHomeOrigin();
    }
  }

  public stop(): void {
    this.isTracking = false;
    if (this.compassUnsub) {
      this.compassUnsub();
      this.compassUnsub = null;
    }
    if (this.pdrUnsub) {
      this.pdrUnsub();
      this.pdrUnsub = null;
    }
  }

  /**
   * Fija la posición tridimensional actual como el Punto de Retorno / Nido (Home Datum).
   */
  public setHomeOrigin(x = this.posX, y = this.posY, z = this.posZ): void {
    this.homeOriginX = x;
    this.homeOriginY = y;
    this.homeOriginZ = z;
    this.homeLocked = true;
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Establece un objetivo táctico tridimensional relativo en metros.
   */
  public setTarget(xMeters: number, yMeters: number, zMeters = 0): void {
    this.targetX = xMeters;
    this.targetY = yMeters;
    this.targetZ = zMeters;
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  public clearTarget(): void {
    this.targetX = null;
    this.targetY = null;
    this.targetZ = null;
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Reinicia la odometría inercial acumulada.
   */
  public resetOdometry(): void {
    this.posX = 0.0;
    this.posY = 0.0;
    this.posZ = 0.0;
    this.totalDistanceTraveled = 0.0;
    this.lastPressureHpa = null;
    this.homeOriginX = 0.0;
    this.homeOriginY = 0.0;
    this.homeOriginZ = 0.0;
    this.targetX = null;
    this.targetY = null;
    this.targetZ = null;
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Reconcilia las coordenadas de posición con un ancla de referencia (anclaje hipocampal / compás dual)
   * corrigiendo la deriva inercial acumulada sin reiniciar la distancia total recorrida.
   */
  public reconcileCoordinates(x: number, y: number, z?: number): void {
    if (!isFinite(x) || !isFinite(y)) return;
    this.posX = x;
    this.posY = y;
    if (typeof z === 'number' && isFinite(z)) {
      this.posZ = z;
    }
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Fórmula Hipsométrica ICAO para calcular el desnivel en metros entre dos presiones barométricas (hPa).
   * Δz = 44330.77 * [ (P_prev / 1013.25)^0.190263 - (P_curr / 1013.25)^0.190263 ]
   */
  public static calculateDeltaAltitudeFromPressure(pPrevHpa: number, pCurrHpa: number): number {
    if (!isFinite(pPrevHpa) || !isFinite(pCurrHpa) || pPrevHpa <= 0 || pCurrHpa <= 0) return 0.0;
    const altPrev = 44330.77 * (1.0 - Math.pow(pPrevHpa / 1013.25, 0.190263));
    const altCurr = 44330.77 * (1.0 - Math.pow(pCurrHpa / 1013.25, 0.190263));
    const delta = altCurr - altPrev;
    return isFinite(delta) ? Math.round(delta * 100) / 100 : 0.0;
  }

  /**
   * Inyecta una lectura barométrica física directa y actualiza el componente altimétrico vertical posZ.
   */
  public injectBarometricPressure(pressureHpa: number): void {
    if (!isFinite(pressureHpa) || pressureHpa < 600 || pressureHpa > 1150) return;
    if (this.lastPressureHpa !== null) {
      const deltaZ = FanShapedBodyEngine.calculateDeltaAltitudeFromPressure(this.lastPressureHpa, pressureHpa);
      this.posZ += deltaZ;
    }
    this.lastPressureHpa = pressureHpa;
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Integración de un paso / desplazamiento traslacional (P-FN & Columnar integration).
   * @param strideMeters Longitud de zancada en metros.
   * @param headingDeg Rumbo inercial en grados azimutales.
   * @param deltaZMeters Desplazamiento vertical en metros (barómetro).
   */
  public integrateStep(strideMeters: number, headingDeg = this.currentHeadingDeg, deltaZMeters = 0.0): void {
    const safeHeading = ((headingDeg % 360) + 360) % 360;
    const headingRad = (safeHeading * Math.PI) / 180;

    // Descomposición traslacional cartesiana
    // Norte = cos(θ), Este = sin(θ)
    const deltaY = strideMeters * Math.cos(headingRad);
    const deltaX = strideMeters * Math.sin(headingRad);

    this.posX += deltaX;
    this.posY += deltaY;
    this.posZ += deltaZMeters;
    this.totalDistanceTraveled += strideMeters;

    // Actualizar neuronas P-FN con desfase de ±45° (π/4)
    // En Drosophila, las neuronas P-FN proyectan desde PB hacia FB con un shift de 45°
    // permitiendo codificar componentes de traslación independientemente de la orientación.
    this.pfnLeft = Math.max(0, Math.cos(headingRad - Math.PI / 4));
    this.pfnRight = Math.max(0, Math.cos(headingRad + Math.PI / 4));

    // Modulación por interneuronas Δ7 (inhibición lateral cosenoidal)
    this.delta7Inhibition = 0.2 + 0.15 * Math.abs(this.pfnLeft - this.pfnRight);

    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Actualiza el rumbo azimutal actual proveniente de RingAttractor.
   */
  public onHeadingUpdated(headingDeg: number): void {
    this.currentHeadingDeg = ((headingDeg % 360) + 360) % 360;
    this.currentHeadingRad = (this.currentHeadingDeg * Math.PI) / 180;
    this.recomputeActivationMatrix();
    this.notifyListeners();
  }

  /**
   * Inyecta una lectura barométrica de altitud relativa para sincronizar la capa Z.
   */
  public updateAltitude(relativeAltitudeMeters: number): void {
    if (isFinite(relativeAltitudeMeters)) {
      this.posZ = relativeAltitudeMeters;
      this.recomputeActivationMatrix();
      this.notifyListeners();
    }
  }

  /**
   * Recomputa la matriz de activación 16x9 del Fan-Shaped Body.
   */
  private recomputeActivationMatrix(): void {
    // Calcular Home Vector actual
    const relHomeX = this.homeOriginX - this.posX;
    const relHomeY = this.homeOriginY - this.posY;
    const homeDistance = Math.sqrt(relHomeX * relHomeX + relHomeY * relHomeY);
    const homeBearingRad = homeDistance > 0.05 ? Math.atan2(relHomeX, relHomeY) : 0;

    // Calcular Goal Vector si existe
    let targetBearingRad = 0;
    if (this.targetX !== null && this.targetY !== null) {
      const relTargetX = this.targetX - this.posX;
      const relTargetY = this.targetY - this.posY;
      targetBearingRad = Math.atan2(relTargetX, relTargetY);
    }

    const currentRad = this.currentHeadingRad - Math.PI; // Mapeado a [-π, π]

    for (let col = 0; col < FanShapedBodyEngine.NUM_COLUMNS; col++) {
      const colAngle = this.columnAnglesRad[col];

      // Sintonización de ángulo de rumbo E-PG (Capas 1-2)
      const diffHeading = Math.cos(colAngle - currentRad);
      const headingActivation = Math.max(0, (diffHeading + 0.3) / 1.3);

      // Capas 3-4 (Δ7 filtrado e inhibición)
      const delta7Active = Math.max(0, headingActivation - this.delta7Inhibition);

      // Capas 5-6 (Integración de desplazamiento / Home Vector)
      const diffHome = Math.cos(colAngle - (homeBearingRad - Math.PI));
      const homeActivation = Math.max(0, diffHome);

      // Capas 7-8 (Altitud / Vector vertical)
      const altNorm = Math.min(1.0, Math.abs(this.posZ - this.homeOriginZ) / 50.0);
      const verticalActivation = Math.max(0, headingActivation * (1.0 - altNorm * 0.3));

      // Capa 9 (Neuronas FBON de timoneo / Steering)
      let steeringActivation = homeActivation;
      if (this.targetX !== null && this.targetY !== null) {
        const diffTarget = Math.cos(colAngle - (targetBearingRad - Math.PI));
        steeringActivation = Math.max(0, diffTarget);
      }

      // Asignación de capas en la matriz plana [col * NUM_LAYERS + layer]
      const baseIdx = col * FanShapedBodyEngine.NUM_LAYERS;
      this.activationMatrix[baseIdx + 0] = headingActivation * this.pfnLeft;
      this.activationMatrix[baseIdx + 1] = headingActivation * this.pfnRight;
      this.activationMatrix[baseIdx + 2] = delta7Active;
      this.activationMatrix[baseIdx + 3] = delta7Active * 0.85;
      this.activationMatrix[baseIdx + 4] = homeActivation;
      this.activationMatrix[baseIdx + 5] = homeActivation * Math.min(1.0, homeDistance / 100.0);
      this.activationMatrix[baseIdx + 6] = verticalActivation;
      this.activationMatrix[baseIdx + 7] = verticalActivation * (this.posZ >= this.homeOriginZ ? 1.0 : 0.5);
      this.activationMatrix[baseIdx + 8] = steeringActivation;
    }
  }

  /**
   * Retorna la telemetría del Fan-Shaped Body con vectores Home y Goal.
   */
  public getTelemetry(): FanShapedBodyTelemetry {
    // Vector de Retorno a Casa (Home Vector H = -x)
    const relHomeX = this.homeOriginX - this.posX;
    const relHomeY = this.homeOriginY - this.posY;
    const relHomeZ = this.homeOriginZ - this.posZ;

    const distanceToHome = Math.sqrt(relHomeX * relHomeX + relHomeY * relHomeY);
    // Rumbo azimutal hacia casa: atan2(Este, Norte) en grados [0, 360)
    let homeBearingDeg = (Math.atan2(relHomeX, relHomeY) * 180) / Math.PI;
    homeBearingDeg = ((homeBearingDeg % 360) + 360) % 360;

    const homeConfidence = distanceToHome > 0.1 ? Math.min(1.0, Math.max(0.4, 1.0 - (this.totalDistanceTraveled * 0.0005))) : 1.0;

    // Vector de Objetivo Táctico (Goal Vector G = target - x)
    let goalDistance = 0;
    let goalBearingDeg = 0;
    let steeringErrorDeg = 0;
    const hasTarget = this.targetX !== null && this.targetY !== null;

    if (hasTarget) {
      const relTargetX = (this.targetX as number) - this.posX;
      const relTargetY = (this.targetY as number) - this.posY;
      goalDistance = Math.sqrt(relTargetX * relTargetX + relTargetY * relTargetY);
      goalBearingDeg = (Math.atan2(relTargetX, relTargetY) * 180) / Math.PI;
      goalBearingDeg = ((goalBearingDeg % 360) + 360) % 360;

      // Error de timoneo = Goal Bearing - Current Heading normalizado a [-180, 180]
      let diff = goalBearingDeg - this.currentHeadingDeg;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      steeringErrorDeg = diff;
    }

    return {
      timestamp: Date.now(),
      columnsCount: FanShapedBodyEngine.NUM_COLUMNS,
      layersCount: FanShapedBodyEngine.NUM_LAYERS,
      columnLayerMatrix: Array.from(this.activationMatrix),
      currentPosition: {
        xMeters: Math.round(this.posX * 10) / 10,
        yMeters: Math.round(this.posY * 10) / 10,
        zMeters: Math.round(this.posZ * 10) / 10,
      },
      totalDistanceTraveledMeters: Math.round(this.totalDistanceTraveled * 10) / 10,
      homeVector: {
        distanceMeters: Math.round(distanceToHome * 10) / 10,
        bearingDeg: Math.round(homeBearingDeg * 10) / 10,
        cardinal: this.degToCardinal(homeBearingDeg),
        deltaAltitudeMeters: Math.round(relHomeZ * 10) / 10,
        confidence: Math.round(homeConfidence * 100) / 100,
      },
      goalVector: {
        hasTarget,
        distanceMeters: Math.round(goalDistance * 10) / 10,
        bearingDeg: Math.round(goalBearingDeg * 10) / 10,
        cardinal: this.degToCardinal(goalBearingDeg),
        steeringErrorDeg: Math.round(steeringErrorDeg * 10) / 10,
      },
      pfnExcitationLeft: Math.round(this.pfnLeft * 100) / 100,
      pfnExcitationRight: Math.round(this.pfnRight * 100) / 100,
      delta7InhibitionLevel: Math.round(this.delta7Inhibition * 100) / 100,
      isSensoryLocked: this.isTracking,
    };
  }

  public subscribe(callback: (telemetry: FanShapedBodyTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const telem = this.getTelemetry();
    for (const listener of this.listeners) {
      try {
        listener(telem);
      } catch {}
    }
  }

  private degToCardinal(deg: number): string {
    const norm = ((deg % 360) + 360) % 360;
    if (norm >= 337.5 || norm < 22.5) return 'N';
    if (norm >= 22.5 && norm < 67.5) return 'NE';
    if (norm >= 67.5 && norm < 112.5) return 'E';
    if (norm >= 112.5 && norm < 157.5) return 'SE';
    if (norm >= 157.5 && norm < 202.5) return 'S';
    if (norm >= 202.5 && norm < 247.5) return 'SW';
    if (norm >= 247.5 && norm < 292.5) return 'W';
    return 'NW';
  }

  public destroy(): void {
    this.stop();
    this.resetOdometry();
    this.listeners.clear();
    FanShapedBodyEngine.instance = null;
  }
}

export const fanShapedBody = FanShapedBodyEngine.getInstance();

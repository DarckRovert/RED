/**
 * OmmatidialCompoundEye.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Modelo biofísico de visión compuesta de insecto (Drosophila melanogaster):
 * - 750 conos omatidiales hexagonales distribuidos en esfera visual mediante espiral de Fibonacci.
 * - Fototransducción retiniana con retardo químico de rodopsina (filtro paso bajo de 1er orden).
 * - Estimación de flujo óptico tangencial (LPTC: Lobula Plate Tangential Cells).
 * - Detección de aproximación de sombras y predadores (LC4: Lobula Columnar 4 Looming Detector).
 * - Acoplamiento monosináptico con GiantFiberReflexEngine para escape balístico en < 15 ms.
 */

import { GiantFiberReflexEngine } from '../GiantFiberReflexEngine';

export interface Ommatidium {
  index: number;
  dirX: number; // Vector unitario en espacio local del agente
  dirY: number;
  dirZ: number;
  elevationRad: number; // [-PI/2, PI/2]
  azimuthRad: number;   // [-PI, PI]
  acceptanceAngleRad: number; // ~0.087 rad (5 grados)
  rhodopsinState: number; // [0.0, 1.0] estado de despolarización filtrada
  lastPhotocurrent: number;
}

export interface LoomingDetectionResult {
  isLooming: boolean;
  expansionRateRadPerSec: number;
  angularRadiusRad: number;
  threatBearingRad: number;
  lc4Activation: number; // [0.0, 1.0]
  timeToImpactSec: number;
}

export interface CompoundEyeTelemetry {
  ommatidiaCount: number;
  meanPhotocurrent: number;
  horizontalOpticalFlow: number; // Torsión tangencial LPTC (rad/s)
  verticalOpticalFlow: number;
  lastLooming: LoomingDetectionResult;
  giantFiberTriggered: boolean;
}

export class OmmatidialCompoundEye {
  public static readonly OMMATIDIA_COUNT = 750;
  private static readonly RHO_TAU_SEC = 0.020; // 20 ms constante de tiempo de rodopsina
  private static readonly LC4_EXPANSION_THRESHOLD = 1.8; // rad/s umbral de escape

  private ommatidia: Ommatidium[] = [];
  private photocurrents: Float32Array; // Búfer continuo para aceleración numérica
  private lastOpticalFlowH: number = 0;
  private lastOpticalFlowV: number = 0;
  private lastLoomingResult: LoomingDetectionResult;

  // Estado histórico para cálculo de expansión angular de sombras
  private previousAngularSize: number = 0;
  private lastShadowDistance: number = 999.0;

  constructor() {
    this.photocurrents = new Float32Array(OmmatidialCompoundEye.OMMATIDIA_COUNT);
    this.lastLoomingResult = {
      isLooming: false,
      expansionRateRadPerSec: 0,
      angularRadiusRad: 0,
      threatBearingRad: 0,
      lc4Activation: 0,
      timeToImpactSec: Infinity,
    };
    this.generateFibonacciOmmatidia();
  }

  /**
   * Genera el teselado geodésico cuasi-uniforme de 750 conos sobre el hemisferio visual.
   */
  private generateFibonacciOmmatidia(): void {
    const phi = (1 + Math.sqrt(5)) * 0.5; // Proporción áurea
    const count = OmmatidialCompoundEye.OMMATIDIA_COUNT;

    for (let i = 0; i < count; i++) {
      // Coordenadas esféricas de Fibonacci acotadas al campo visual frontal/lateral/dorsal
      // (Drosophila cubre ~300° en azimut y 180° en elevación)
      const y = 1.0 - (i / (count - 1)) * 1.8; // Ligero sesgo hacia elevaciones positivas
      const radiusAtY = Math.sqrt(Math.max(0, 1.0 - y * y));
      const theta = 2.0 * Math.PI * i / phi;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const azimuth = Math.atan2(x, z);
      const elevation = Math.asin(Math.max(-1, Math.min(1, y)));

      this.ommatidia.push({
        index: i,
        dirX: x,
        dirY: y,
        dirZ: z,
        elevationRad: elevation,
        azimuthRad: azimuth,
        acceptanceAngleRad: 0.087, // ~5° ángulo de aceptación interommatidial
        rhodopsinState: 0.0,
        lastPhotocurrent: 0.0,
      });
    }
  }

  /**
   * Actualiza el ojo compuesto muestreando la radiancia del entorno y objetos cercanos.
   * 
   * @param dt Segundos transcurridos
   * @param ambientLuminance Nivel de luz ambiental [0.0 - 1.0]
   * @param shadows Lista de sombras o proyectores 'looming' activos en el hábitat
   */
  public step(
    dt: number,
    ambientLuminance: number = 0.8,
    shadows: Array<{ x: number; y: number; z: number; radiusMeters: number; velocityMps: number }> = []
  ): void {
    const alpha = Math.min(1.0, dt / OmmatidialCompoundEye.RHO_TAU_SEC);
    let totalPhotocurrent = 0;

    // 1. Simulación de fototransducción con retardo químico
    for (let i = 0; i < this.ommatidia.length; i++) {
      const omm = this.ommatidia[i];
      let incidentLight = ambientLuminance;

      // Atenuar fotones si una sombra cae dentro del cono de aceptación omatidial
      for (const shadow of shadows) {
        const shadowDist = Math.hypot(shadow.x, shadow.z);
        if (shadowDist > 0.01) {
          const shadowDirX = shadow.x / shadowDist;
          const shadowDirZ = shadow.z / shadowDist;
          const dot = omm.dirX * shadowDirX + omm.dirZ * shadowDirZ;

          const angularShadowRadius = Math.atan2(shadow.radiusMeters, Math.max(0.1, shadowDist));
          const angleToCenter = Math.acos(Math.max(-1, Math.min(1, dot)));

          if (angleToCenter < angularShadowRadius + omm.acceptanceAngleRad) {
            incidentLight *= 0.15; // Bloqueo sustancial de radiancia por sombra
          }
        }
      }

      // Filtro paso bajo de 1er orden de rodopsina
      omm.rhodopsinState += (incidentLight - omm.rhodopsinState) * alpha;
      omm.lastPhotocurrent = omm.rhodopsinState;
      this.photocurrents[i] = omm.lastPhotocurrent;
      totalPhotocurrent += omm.lastPhotocurrent;
    }

    // 2. Detección de Expansión Angular Looming (Neuronas LC4 / LPLC2)
    this.evaluateLoomingThreat(dt, shadows);

    // 3. Estimación de Flujo Óptico Retiniano (LPTC)
    this.calculateOpticalFlow(dt);
  }

  /**
   * Modela los detectores lobulares LC4.
   * Si la sombra se expande angularmente con velocidad crítica dTheta/dt > threshold,
   * despolariza instantáneamente el Giant Fiber Reflex en < 15 ms.
   */
  private evaluateLoomingThreat(
    dt: number,
    shadows: Array<{ x: number; y: number; z: number; radiusMeters: number; velocityMps: number }>
  ): void {
    if (shadows.length === 0) {
      this.lastLoomingResult = {
        isLooming: false,
        expansionRateRadPerSec: 0,
        angularRadiusRad: 0,
        threatBearingRad: 0,
        lc4Activation: 0,
        timeToImpactSec: Infinity,
      };
      this.previousAngularSize = 0;
      return;
    }

    // Evaluar la sombra más amenazante (mayor expansión angular)
    let maxExpansion = 0;
    let mostCriticalBearing = 0;
    let currentAngularSize = 0;
    let minTtc = Infinity;

    for (const shadow of shadows) {
      const dist = Math.hypot(shadow.x, shadow.z);
      if (dist < 0.05) continue;

      const theta = 2.0 * Math.atan2(shadow.radiusMeters, dist);
      currentAngularSize = Math.max(currentAngularSize, theta);

      let expansionRate = 0;
      if (this.previousAngularSize > 0 && dt > 0) {
        expansionRate = (theta - this.previousAngularSize) / dt;
      }

      if (expansionRate > maxExpansion) {
        maxExpansion = expansionRate;
        mostCriticalBearing = Math.atan2(shadow.x, shadow.z);
        if (shadow.velocityMps > 0) {
          minTtc = dist / shadow.velocityMps;
        }
      }
    }

    this.previousAngularSize = currentAngularSize;
    const isThreatLooming = maxExpansion >= OmmatidialCompoundEye.LC4_EXPANSION_THRESHOLD;
    const lc4Activation = Math.min(1.0, maxExpansion / (OmmatidialCompoundEye.LC4_EXPANSION_THRESHOLD * 2.0));

    this.lastLoomingResult = {
      isLooming: isThreatLooming,
      expansionRateRadPerSec: maxExpansion,
      angularRadiusRad: currentAngularSize,
      threatBearingRad: mostCriticalBearing,
      lc4Activation,
      timeToImpactSec: minTtc,
    };

    // Disparo Monosináptico Inmediato del Arco Reflejo Gigante (Giant Fiber)
    if (isThreatLooming) {
      try {
        GiantFiberReflexEngine.getInstance().triggerReflex('VISUAL_LOOMING_THREAT');
      } catch {
        // En entorno mock o de prueba aislada
      }
    }
  }

  /**
   * Calcula el flujo óptico tangencial integrando diferencias hemisféricas.
   */
  private calculateOpticalFlow(_dt: number): void {
    let leftHemisphereCurrent = 0;
    let rightHemisphereCurrent = 0;
    let leftCount = 0;
    let rightCount = 0;

    for (let i = 0; i < this.ommatidia.length; i++) {
      const omm = this.ommatidia[i];
      if (omm.azimuthRad < 0) {
        leftHemisphereCurrent += omm.lastPhotocurrent;
        leftCount++;
      } else {
        rightHemisphereCurrent += omm.lastPhotocurrent;
        rightCount++;
      }
    }

    const meanLeft = leftCount > 0 ? leftHemisphereCurrent / leftCount : 0;
    const meanRight = rightCount > 0 ? rightHemisphereCurrent / rightCount : 0;

    // Diferencia hemisférica normalizada: torsión horizontal
    this.lastOpticalFlowH = (meanRight - meanLeft) * 2.5;
    this.lastOpticalFlowV = 0.0;
  }

  public getTelemetry(): CompoundEyeTelemetry {
    let meanI = 0;
    for (let i = 0; i < this.photocurrents.length; i++) {
      meanI += this.photocurrents[i];
    }
    meanI /= this.photocurrents.length;

    return {
      ommatidiaCount: OmmatidialCompoundEye.OMMATIDIA_COUNT,
      meanPhotocurrent: meanI,
      horizontalOpticalFlow: this.lastOpticalFlowH,
      verticalOpticalFlow: this.lastOpticalFlowV,
      lastLooming: this.lastLoomingResult,
      giantFiberTriggered: this.lastLoomingResult.isLooming,
    };
  }

  public getPhotocurrentBuffer(): Float32Array {
    return this.photocurrents;
  }
}

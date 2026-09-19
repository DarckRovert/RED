/**
 * EntorhinalGridCellEngine.ts — RED Sovereign Mesh OS
 * 
 * Emulación Bio-Neuromórfica de la Corteza Entorrinal Medial Humana (MEC)
 * y Células de Rejilla Hexagonales (Grid Cells & Border Cells).
 * 
 * Fundamento Neurobiológico (Moser & Moser, Nobel 2014):
 * A diferencia del Central Complex 1D de insectos, el sistema entorrinal humano genera
 * una métrica espacial 2D/3D periódica e invariante de escala mediante teselaciones
 * hexagonales compactas con simetría de 60°.
 * 
 * Arquitectura Matemática:
 * 1. 4 Módulos de Escala Geométrica Progresiva:
 *    - Módulo 1 (Micro-Táctica): λ = 0.50 m (Desplazamiento a gatas / escombros)
 *    - Módulo 2 (Corto Alcance):  λ = 2.00 m (Habitación / trinchera / túnel)
 *    - Módulo 3 (Táctico Medio):  λ = 8.00 m (Complejo edilicio / cueva)
 *    - Módulo 4 (Macro-Área):     λ = 32.00 m (Valle / bosque denso)
 * 2. Formulación de Interferencia Ondulatoria Hexagonal:
 *    Cada módulo m calcula la actividad periódica a partir de 3 ondas planas a 0°, 60° y 120°:
 *    ψ_m(x, y) = 1/3 * Σ_{j=1}^3 cos( k_{m,j} · r + φ_{m,j} )
 *    donde |k_m| = 4π / (λ_m * sqrt(3)).
 * 3. Células de Borde (Border Cells): Disparan ante obstáculos detectados (ToF/Sonar/Acelerometría).
 * 4. Odometría Cognitiva sin GNSS: Navegación autónoma en túneles, minas y escombros.
 */

import { pedestrianDeadReckoning, PdrState } from '../../sensors/PedestrianDeadReckoningEngine';
import { fanShapedBody, FanShapedBodyTelemetry } from '../FanShapedBodyEngine';
import { ringAttractor } from '../RingAttractorEngine';

export interface GridModuleTelemetry {
  moduleIndex: number;
  scaleWavelengthMeters: number;
  firingIntensity: number; // [0.0 - 1.0]
  phaseX: number;
  phaseY: number;
}

export interface CognitiveWaypoint {
  id: string;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  gridFingerprint: number[]; // Vector de firma de 4 módulos
  timestamp: number;
  label: string;
}

export interface EntorhinalTelemetry {
  timestamp: number;
  modules: GridModuleTelemetry[];
  compositeGridActivity: number; // [0.0 - 1.0] Densidad de activación de rejilla
  currentCoordsLocal: { xMeters: number; yMeters: number; zMeters: number };
  borderProximityWarning: boolean;
  breadcrumbsCount: number;
  estimatedDriftMeters: number;
}

export class EntorhinalGridCellEngine {
  private static instance: EntorhinalGridCellEngine | null = null;

  // 4 Escalas de onda espacial en progresión geométrica (~factor 4)
  public static readonly WAVELENGTHS = [0.5, 2.0, 8.0, 32.0];
  private static readonly SQRT_3 = Math.sqrt(3);

  // Coordenadas inerciales relativas respecto al punto de anclaje (metros)
  private posX = 0.0;
  private posY = 0.0;
  private posZ = 0.0;

  // Fases espaciales acumuladas para los 4 módulos
  private modulePhases: { x: number; y: number }[];
  private borderProximity = false;
  private breadcrumbs: CognitiveWaypoint[] = [];
  private lastBreadcrumbDistance = 0.0;
  private totalTraveledMeters = 0.0;

  private isRunning = false;
  private unsubs: (() => void)[] = [];
  private listeners: Set<(telemetry: EntorhinalTelemetry) => void> = new Set();

  private constructor() {
    this.modulePhases = EntorhinalGridCellEngine.WAVELENGTHS.map(() => ({ x: 0.0, y: 0.0 }));
  }

  public static getInstance(): EntorhinalGridCellEngine {
    if (!EntorhinalGridCellEngine.instance) {
      EntorhinalGridCellEngine.instance = new EntorhinalGridCellEngine();
    }
    return EntorhinalGridCellEngine.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Suscripción a PDR (Pedestrian Dead Reckoning inercial)
    const unsubPdr = pedestrianDeadReckoning.subscribe((pdr: PdrState) => {
      this.integrateMotion(pdr.distanceMeters, pdr.currentHeadingDeg);
    });

    // 2. Suscripción a Fan-Shaped Body para sincronización de altitud barométrica Z
    const unsubFb = fanShapedBody.subscribe((fb: FanShapedBodyTelemetry) => {
      this.posZ = fb.currentPosition.zMeters;
      this.notifyListeners();
    });

    this.unsubs.push(unsubPdr, unsubFb);
  }

  public stop(): void {
    this.isRunning = false;
    this.unsubs.forEach(u => {
      try { u(); } catch {}
    });
    this.unsubs = [];
  }

  /**
   * Integra el vector de desplazamiento inercial (Δd, rumbo) en la teselación hexagonal.
   */
  public integrateMotion(deltaDistanceMeters: number, headingDeg: number): void {
    if (deltaDistanceMeters <= 0.001) return;

    const angleRad = (headingDeg * Math.PI) / 180;
    const dx = deltaDistanceMeters * Math.sin(angleRad); // Este (+)
    const dy = deltaDistanceMeters * Math.cos(angleRad); // Norte (+)

    this.posX += dx;
    this.posY += dy;
    this.totalTraveledMeters += deltaDistanceMeters;

    // Actualizar fases de rejilla en cada módulo
    for (let m = 0; m < EntorhinalGridCellEngine.WAVELENGTHS.length; m++) {
      const lambda = EntorhinalGridCellEngine.WAVELENGTHS[m];
      this.modulePhases[m].x = (this.modulePhases[m].x + dx) % lambda;
      this.modulePhases[m].y = (this.modulePhases[m].y + dy) % lambda;
    }

    // Comprobación de miga de pan cognitiva (cada 5 metros recorridos)
    if (this.totalTraveledMeters - this.lastBreadcrumbDistance >= 5.0) {
      this.lastBreadcrumbDistance = this.totalTraveledMeters;
      this.dropBreadcrumb(`CP-${this.breadcrumbs.length + 1}`);
    }

    this.notifyListeners();
  }

  /**
   * Calcula la respuesta de activación hexagonal para un módulo m en la posición (x, y).
   * Genera el patrón característico de simetría rómbico-hexagonal de 60°.
   */
  public calculateHexagonalActivation(moduleIndex: number, x: number = this.posX, y: number = this.posY): number {
    const lambda = EntorhinalGridCellEngine.WAVELENGTHS[moduleIndex] || 2.0;
    const k = (4.0 * Math.PI) / (lambda * EntorhinalGridCellEngine.SQRT_3);

    // 3 Ondas planas a 0°, 60° (π/3) y 120° (2π/3)
    const angle1 = 0.0;
    const angle2 = Math.PI / 3.0;
    const angle3 = (2.0 * Math.PI) / 3.0;

    const wave1 = Math.cos(k * (x * Math.cos(angle1) + y * Math.sin(angle1)));
    const wave2 = Math.cos(k * (x * Math.cos(angle2) + y * Math.sin(angle2)));
    const wave3 = Math.cos(k * (x * Math.cos(angle3) + y * Math.sin(angle3)));

    const rawInterference = (wave1 + wave2 + wave3) / 3.0;
    // Normalizar a rango [0.0, 1.0] con umbral de no-linealidad neuronal
    return Math.max(0.0, Math.min(1.0, (rawInterference + 0.5) / 1.5));
  }

  /**
   * Genera una firma topológica única de la posición actual (Grid Fingerprint).
   */
  public getGridFingerprint(): number[] {
    return EntorhinalGridCellEngine.WAVELENGTHS.map((_, idx) =>
      Math.round(this.calculateHexagonalActivation(idx) * 1000) / 1000
    );
  }

  /**
   * Registra una miga de pan cognitiva en el mapa entorrinal.
   */
  public dropBreadcrumb(label: string = 'Punto Inercial'): CognitiveWaypoint {
    const wp: CognitiveWaypoint = {
      id: `CRUMB-${Date.now().toString(36).toUpperCase()}`,
      xMeters: Math.round(this.posX * 100) / 100,
      yMeters: Math.round(this.posY * 100) / 100,
      zMeters: Math.round(this.posZ * 100) / 100,
      gridFingerprint: this.getGridFingerprint(),
      timestamp: Date.now(),
      label,
    };
    this.breadcrumbs.push(wp);
    if (this.breadcrumbs.length > 500) {
      this.breadcrumbs.shift();
    }
    this.notifyListeners();
    return wp;
  }

  public getBreadcrumbs(): CognitiveWaypoint[] {
    return [...this.breadcrumbs];
  }

  public resetOrigin(): void {
    this.posX = 0.0;
    this.posY = 0.0;
    this.posZ = 0.0;
    this.totalTraveledMeters = 0.0;
    this.lastBreadcrumbDistance = 0.0;
    this.breadcrumbs = [];
    this.modulePhases = EntorhinalGridCellEngine.WAVELENGTHS.map(() => ({ x: 0.0, y: 0.0 }));
    this.dropBreadcrumb('ORIGEN TÁCTICO (DATUM 0,0,0)');
    this.notifyListeners();
  }

  public setBorderWarning(isClose: boolean): void {
    this.borderProximity = isClose;
    this.notifyListeners();
  }

  /**
   * Computa el vector de retorno guiado a ciegas (inversión de migas de pan / vector de escape hacia el origen).
   */
  public computeReverseReturnVector(): { distanceMeters: number; bearingDeg: number } {
    const dist = Math.hypot(this.posX, this.posY);
    let bearingRad = Math.atan2(-this.posX, -this.posY);
    let bearingDeg = (bearingRad * 180.0) / Math.PI;
    if (bearingDeg < 0) bearingDeg += 360.0;
    return {
      distanceMeters: Math.round(dist * 10) / 10,
      bearingDeg: Math.round(bearingDeg * 10) / 10
    };
  }

  public getTelemetry(): EntorhinalTelemetry {
    const modules: GridModuleTelemetry[] = EntorhinalGridCellEngine.WAVELENGTHS.map((lambda, idx) => ({
      moduleIndex: idx,
      scaleWavelengthMeters: lambda,
      firingIntensity: Math.round(this.calculateHexagonalActivation(idx) * 100) / 100,
      phaseX: Math.round(this.modulePhases[idx].x * 100) / 100,
      phaseY: Math.round(this.modulePhases[idx].y * 100) / 100,
    }));

    const composite = modules.reduce((acc, m) => acc + m.firingIntensity, 0) / modules.length;
    const estimatedDrift = Math.round(this.totalTraveledMeters * 0.015 * 10) / 10; // ~1.5% de deriva inercial típica

    return {
      timestamp: Date.now(),
      modules,
      compositeGridActivity: Math.round(composite * 100) / 100,
      currentCoordsLocal: {
        xMeters: Math.round(this.posX * 10) / 10,
        yMeters: Math.round(this.posY * 10) / 10,
        zMeters: Math.round(this.posZ * 10) / 10,
      },
      borderProximityWarning: this.borderProximity,
      breadcrumbsCount: this.breadcrumbs.length,
      estimatedDriftMeters: estimatedDrift,
    };
  }

  public subscribe(callback: (telemetry: EntorhinalTelemetry) => void): () => void {
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

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    EntorhinalGridCellEngine.instance = null;
  }
}

export const entorhinalGridCell = EntorhinalGridCellEngine.getInstance();

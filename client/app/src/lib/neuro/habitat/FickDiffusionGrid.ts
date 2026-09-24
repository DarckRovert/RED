/**
 * FickDiffusionGrid.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Solucionador numérico en diferencias finitas de la ecuación de difusión de Fick
 * bidimensional con advección eólica y decaimiento molecular:
 *   ∂C/∂t = D ∇²C - λ C - (v · ∇C) + S(x,y,t)
 * 
 * Diseñado con asignación cero en memoria (Zero-GC) mediante búferes planos Float32Array
 * y fronteras continuas Neumann (sin fuga) para garantizar conservación de masa.
 */

export type ChemicalSubstance =
  | 'GLUCOSE'
  | 'PHEROMONE_TRAIL'
  | 'ALARM_PHEROMONE'
  | 'SEROTONIN'
  | 'MYCELIUM_NUTRIENTS';

export interface ChemicalSource {
  id: string;
  x: number; // Coordenadas continuas en metros [0, arenaWidth]
  y: number; // Coordenadas continuas en metros [0, arenaHeight]
  substance: ChemicalSubstance;
  emissionRate: number; // Unidades/segundo emitidas
  currentMass: number; // Masa total disponible (se agota con el tiempo/ingesta)
  radius: number; // Radio físico de la gota
}

export interface AcousticBarrier {
  id: string;
  x1: number; // Coordenadas continuas en metros
  y1: number;
  x2: number;
  y2: number;
  radiusMeters?: number;
}

export interface AntennalSample {
  leftConcentration: number;
  rightConcentration: number;
  delta: number; // C_der - C_izq
  meanConcentration: number;
}

export class FickDiffusionGrid {
  public readonly width: number;
  public readonly height: number;
  public readonly cellSize: number; // Metros por celda
  public readonly arenaWidthMeters: number;
  public readonly arenaHeightMeters: number;

  // Parámetros biofísicos por sustancia: [Difusión D, Decaimiento λ]
  private static readonly SUBSTANCE_PARAMS: Record<ChemicalSubstance, { D: number; lambda: number }> = {
    GLUCOSE: { D: 0.12, lambda: 0.002 },
    PHEROMONE_TRAIL: { D: 0.04, lambda: 0.015 },
    ALARM_PHEROMONE: { D: 0.28, lambda: 0.060 },
    SEROTONIN: { D: 0.14, lambda: 0.004 },
    MYCELIUM_NUTRIENTS: { D: 0.07, lambda: 0.001 },
  };

  // Búferes planos contiguos: 3 sustancias * 2 buffers (current y next) para ping-pong
  private grids: Record<ChemicalSubstance, { current: Float32Array; next: Float32Array }>;
  private sources: Map<string, ChemicalSource> = new Map();
  private barriers: Map<string, AcousticBarrier> = new Map();
  private barrierGrid: Uint8Array;

  // Integral de masa decaída acumulada para auditoría de conservación termodinámica
  private accumulatedDecayedMass: Record<ChemicalSubstance, number> = {
    GLUCOSE: 0,
    PHEROMONE_TRAIL: 0,
    ALARM_PHEROMONE: 0,
    SEROTONIN: 0,
    MYCELIUM_NUTRIENTS: 0,
  };

  constructor(
    arenaWidthMeters: number = 20.0,
    arenaHeightMeters: number = 20.0,
    gridResolution: number = 64
  ) {
    this.arenaWidthMeters = arenaWidthMeters;
    this.arenaHeightMeters = arenaHeightMeters;
    this.width = gridResolution;
    this.height = gridResolution;
    this.cellSize = arenaWidthMeters / gridResolution;

    const cellCount = this.width * this.height;
    this.barrierGrid = new Uint8Array(cellCount);
    this.grids = {
      GLUCOSE: {
        current: new Float32Array(cellCount),
        next: new Float32Array(cellCount),
      },
      PHEROMONE_TRAIL: {
        current: new Float32Array(cellCount),
        next: new Float32Array(cellCount),
      },
      ALARM_PHEROMONE: {
        current: new Float32Array(cellCount),
        next: new Float32Array(cellCount),
      },
      SEROTONIN: {
        current: new Float32Array(cellCount),
        next: new Float32Array(cellCount),
      },
      MYCELIUM_NUTRIENTS: {
        current: new Float32Array(cellCount),
        next: new Float32Array(cellCount),
      },
    };
  }

  /**
   * Obtiene el búfer plano Float32Array continuo para renderizado directo en Canvas.
   */
  public getBuffer(substance: ChemicalSubstance): Float32Array {
    return this.grids[substance].current;
  }

  /**
   * Gestión de barreras acústicas y obstáculos impermeables a sustancias.
   */
  public addBarrier(barrier: AcousticBarrier): void {
    this.barriers.set(barrier.id, { ...barrier });
    this.rasterizeBarriers();
  }

  public removeBarrier(id: string): void {
    this.barriers.delete(id);
    this.rasterizeBarriers();
  }

  public clearBarriers(): void {
    this.barriers.clear();
    this.barrierGrid.fill(0);
  }

  public getBarriers(): AcousticBarrier[] {
    return Array.from(this.barriers.values());
  }

  public isPointBlocked(x: number, y: number): boolean {
    const gx = Math.floor((x / this.arenaWidthMeters) * this.width);
    const gy = Math.floor((y / this.arenaHeightMeters) * this.height);
    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) return true;
    return this.barrierGrid[gy * this.width + gx] === 1;
  }

  private rasterizeBarriers(): void {
    this.barrierGrid.fill(0);
    for (const b of this.barriers.values()) {
      const gX1 = (b.x1 / this.arenaWidthMeters) * this.width;
      const gY1 = (b.y1 / this.arenaHeightMeters) * this.height;
      const gX2 = (b.x2 / this.arenaWidthMeters) * this.width;
      const gY2 = (b.y2 / this.arenaHeightMeters) * this.height;

      const dist = Math.hypot(gX2 - gX1, gY2 - gY1);
      const steps = Math.max(1, Math.ceil(dist * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = Math.floor(gX1 + (gX2 - gX1) * t);
        const y = Math.floor(gY1 + (gY2 - gY1) * t);
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          this.barrierGrid[y * this.width + x] = 1;
        }
      }
    }
  }

  /**
   * Añade o actualiza una fuente química discreta en el hábitat.
   */
  public addSource(source: ChemicalSource): void {
    this.sources.set(source.id, { ...source });
  }

  public removeSource(id: string): void {
    this.sources.delete(id);
  }

  public getSource(id: string): ChemicalSource | undefined {
    return this.sources.get(id);
  }

  public getAllSources(): ChemicalSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Inyecta masa química directamente en una coordenada continua (x, y).
   */
  public injectChemical(
    x: number,
    y: number,
    amount: number,
    substance: ChemicalSubstance
  ): void {
    if (amount <= 0) return;
    const gx = Math.floor((x / this.arenaWidthMeters) * this.width);
    const gy = Math.floor((y / this.arenaHeightMeters) * this.height);

    if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height) {
      const idx = gy * this.width + gx;
      this.grids[substance].current[idx] += amount;
    }
  }

  /**
   * Muestrea la concentración escalar en coordenadas continuas del hábitat (x, y).
   * Utiliza interpolación bilineal entre las 4 celdas más cercanas.
   */
  public sample(x: number, y: number, substance: ChemicalSubstance = 'GLUCOSE'): number {
    const normX = (x / this.arenaWidthMeters) * (this.width - 1);
    const normY = (y / this.arenaHeightMeters) * (this.height - 1);

    const x0 = Math.max(0, Math.min(this.width - 1, Math.floor(normX)));
    const y0 = Math.max(0, Math.min(this.height - 1, Math.floor(normY)));
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y1 = Math.min(this.height - 1, y0 + 1);

    const fx = normX - x0;
    const fy = normY - y0;

    const grid = this.grids[substance].current;
    const v00 = grid[y0 * this.width + x0];
    const v10 = grid[y0 * this.width + x1];
    const v01 = grid[y1 * this.width + x0];
    const v11 = grid[y1 * this.width + x1];

    const top = v00 * (1 - fx) + v10 * fx;
    const bottom = v01 * (1 - fx) + v11 * fx;

    return top * (1 - fy) + bottom * fy;
  }

  /**
   * Muestreo diferencial biológico por par de antenas con orientación espacial (heading).
   * No lee coordenadas de fuentes, solo la diferencia física local en el aire.
   */
  public sampleAntennaPair(
    centerX: number,
    centerY: number,
    headingRad: number,
    interAntennaDistanceMeters: number = 0.05,
    substance: ChemicalSubstance = 'GLUCOSE'
  ): AntennalSample {
    const halfDist = interAntennaDistanceMeters * 0.5;

    // Vector perpendicular al rumbo orientado hacia la derecha (+90° CW en coordenadas cartesianas)
    const rightAngle = headingRad - Math.PI * 0.5;
    const dx = Math.cos(rightAngle) * halfDist;
    const dy = Math.sin(rightAngle) * halfDist;

    const rightX = centerX + dx;
    const rightY = centerY + dy;
    const leftX = centerX - dx;
    const leftY = centerY - dy;

    const leftConcentration = this.sample(leftX, leftY, substance);
    const rightConcentration = this.sample(rightX, rightY, substance);

    return {
      leftConcentration,
      rightConcentration,
      delta: rightConcentration - leftConcentration,
      meanConcentration: (leftConcentration + rightConcentration) * 0.5,
    };
  }

  /**
   * Avanza la física de difusión y advección por un paso temporal dt.
   * Utiliza stencil de 5 puntos y esquema de advección upwind estable.
   */
  public step(
    dt: number,
    windVector: { vx: number; vy: number } = { vx: 0, vy: 0 }
  ): void {
    const substances: ChemicalSubstance[] = [
      'GLUCOSE',
      'PHEROMONE_TRAIL',
      'ALARM_PHEROMONE',
      'SEROTONIN',
      'MYCELIUM_NUTRIENTS'
    ];

    // 1. Emitir desde fuentes activas
    for (const [id, source] of this.sources.entries()) {
      if (source.currentMass <= 0) {
        this.sources.delete(id);
        continue;
      }
      const emitted = Math.min(source.currentMass, source.emissionRate * dt);
      source.currentMass -= emitted;
      this.injectChemical(source.x, source.y, emitted, source.substance);
    }

    const h2 = this.cellSize * this.cellSize;
    const invH = 1.0 / this.cellSize;

    for (const sub of substances) {
      const { D, lambda } = FickDiffusionGrid.SUBSTANCE_PARAMS[sub];
      // Límite de estabilidad numérica de Courant-Friedrichs-Lewy (CFL)
      const maxStableD = 0.9 * (h2 / (4 * Math.max(0.0001, dt)));
      const effectiveD = Math.min(D, maxStableD);

      const cur = this.grids[sub].current;
      const nxt = this.grids[sub].next;
      let decayedThisStep = 0;

      for (let y = 0; y < this.height; y++) {
        const yOffset = y * this.width;
        const upOffset = (y > 0 ? y - 1 : y) * this.width;
        const downOffset = (y < this.height - 1 ? y + 1 : y) * this.width;

        for (let x = 0; x < this.width; x++) {
          const idx = yOffset + x;

          // Si la celda está bloqueada por una barrera acústica, no almacena masa
          if (this.barrierGrid[idx] === 1) {
            nxt[idx] = 0;
            continue;
          }

          const leftIdx = yOffset + (x > 0 ? x - 1 : x);
          const rightIdx = yOffset + (x < this.width - 1 ? x + 1 : x);

          const cCenter = cur[idx];
          // Reflexión Neumann en obstáculos (flujo cero a través de la pared)
          const cLeft = this.barrierGrid[leftIdx] === 1 ? cCenter : cur[leftIdx];
          const cRight = this.barrierGrid[rightIdx] === 1 ? cCenter : cur[rightIdx];
          const cUp = this.barrierGrid[upOffset + x] === 1 ? cCenter : cur[upOffset + x];
          const cDown = this.barrierGrid[downOffset + x] === 1 ? cCenter : cur[downOffset + x];

          // Laplaciano ∇²C (Fronteras Neumann sin fuga al exterior ni a través de barreras)
          const laplacian = (cLeft + cRight + cUp + cDown - 4 * cCenter) / h2;

          // Advección eólica de 1er orden upwind
          let advX = 0;
          if (windVector.vx > 0) {
            advX = windVector.vx * (cCenter - cLeft) * invH;
          } else if (windVector.vx < 0) {
            advX = windVector.vx * (cRight - cCenter) * invH;
          }

          let advY = 0;
          if (windVector.vy > 0) {
            advY = windVector.vy * (cCenter - cUp) * invH;
          } else if (windVector.vy < 0) {
            advY = windVector.vy * (cDown - cCenter) * invH;
          }

          // Decaimiento molecular exponencial
          const decay = lambda * cCenter;
          decayedThisStep += decay * dt;

          // Ecuación completa de transporte continuo
          const dC = (effectiveD * laplacian - decay - (advX + advY)) * dt;
          nxt[idx] = Math.max(0, cCenter + dC);
        }
      }

      this.accumulatedDecayedMass[sub] += decayedThisStep;

      // Intercambio ping-pong de búferes contiguos
      this.grids[sub].current = nxt;
      this.grids[sub].next = cur;
    }
  }

  /**
   * Calcula la masa total actualmente dispersa en el hábitat para una sustancia.
   */
  public getTotalMassInGrid(substance: ChemicalSubstance): number {
    const grid = this.grids[substance].current;
    let sum = 0;
    for (let i = 0; i < grid.length; i++) {
      sum += grid[i];
    }
    return sum;
  }

  /**
   * Obtiene la masa total que ha decaído por evaporación.
   */
  public getAccumulatedDecayedMass(substance: ChemicalSubstance): number {
    return this.accumulatedDecayedMass[substance];
  }

  /**
   * Reinicia la grilla para pruebas o reciclaje de escenario.
   */
  public reset(): void {
    const substances: ChemicalSubstance[] = [
      'GLUCOSE',
      'PHEROMONE_TRAIL',
      'ALARM_PHEROMONE',
      'SEROTONIN',
      'MYCELIUM_NUTRIENTS'
    ];
    for (const sub of substances) {
      this.grids[sub].current.fill(0);
      this.grids[sub].next.fill(0);
      this.accumulatedDecayedMass[sub] = 0;
    }
    this.sources.clear();
  }
}

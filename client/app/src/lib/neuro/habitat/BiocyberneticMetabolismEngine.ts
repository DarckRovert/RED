/**
 * BiocyberneticMetabolismEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Motor termodinámico y de conservación de masa celular in-silico:
 * Modela la ingesta digestiva, glucosa en hemolinfa, síntesis de ATP mitocondrial
 * y el gasto energético continuo por potenciales de acción neuronales y trabajo mecánico.
 */

export type MetabolicState = 'OPTIMAL' | 'ENERGY_SAVING' | 'TORPOR' | 'APOPTOSIS';

export interface MetabolicTelemetry {
  state: MetabolicState;
  atpLevel: number; // Porcentaje relativo [0.0, 1.0]
  glucoseLevel: number; // Porcentaje relativo [0.0, 1.0]
  storedTrehaloseUnits: number; // Masa de reserva almacenada en hemolinfa
  atpConsumptionRate: number; // Unidades/segundo
  atpSynthesisRate: number; // Unidades/segundo
  totalEnergyExpendedJoules: number;
  timeInCriticalTorporSeconds: number;
  isDead: boolean;
}

export class BiocyberneticMetabolismEngine {
  // Capacidad máxima de depósitos (unidades biofísicas relativas)
  private static readonly MAX_ATP = 100.0;
  private static readonly MAX_GLUCOSE = 100.0;
  private static readonly MAX_TREHALOSE = 500.0;

  // Tasas cinéticas biofísicas
  private static readonly BASAL_METABOLIC_RATE = 0.08; // Costo por segundo en reposo
  private static readonly ENERGY_PER_SPIKE = 0.0005; // ATP por potencial de acción
  private static readonly JOULES_PER_ATP_UNIT = 0.05; // Conversión a Joules
  private static readonly TORPOR_CRITICAL_TIMEOUT_SEC = 45.0; // Tiempo en coma antes de muerte

  // Estado interno
  private atp: number;
  private glucose: number;
  private trehalose: number;
  private state: MetabolicState = 'OPTIMAL';
  private totalJoulesExpended: number = 0;
  private timeInTorpor: number = 0;
  private isDead: boolean = false;

  private lastAtpConsumptionRate: number = 0;
  private lastAtpSynthesisRate: number = 0;

  constructor(initialEnergyRatio: number = 1.0) {
    const ratio = Math.max(0.1, Math.min(1.0, initialEnergyRatio));
    this.atp = BiocyberneticMetabolismEngine.MAX_ATP * ratio;
    this.glucose = BiocyberneticMetabolismEngine.MAX_GLUCOSE * ratio;
    this.trehalose = BiocyberneticMetabolismEngine.MAX_TREHALOSE * ratio;
  }

  /**
   * Registra la ingestión de néctar/glucosa absorbida a través de la probóscide.
   * La masa ingerida se deposita primero como glucosa y el exceso como trehalosa.
   */
  public ingestNutrient(massUnits: number): number {
    if (this.isDead || massUnits <= 0) return 0;

    const availableGlucoseSpace = BiocyberneticMetabolismEngine.MAX_GLUCOSE - this.glucose;
    const directGlucose = Math.min(availableGlucoseSpace, massUnits);
    this.glucose += directGlucose;

    const remaining = massUnits - directGlucose;
    if (remaining > 0) {
      const availableTrehaloseSpace = BiocyberneticMetabolismEngine.MAX_TREHALOSE - this.trehalose;
      const stored = Math.min(availableTrehaloseSpace, remaining);
      this.trehalose += stored;
      return directGlucose + stored;
    }

    return directGlucose;
  }

  /**
   * Integra un paso de tiempo dt, deduciendo costos neuronales y mecánicos.
   * 
   * @param dt Segundos transcurridos en el tick de física
   * @param spikeCount Número de espigas neuronales disparadas en el cerebro este tick
   * @param mechanicalPower Trabajo articular mecánico instantáneo (sumatoria de |tau * omega|)
   */
  public step(dt: number, spikeCount: number = 0, mechanicalPower: number = 0): void {
    if (this.isDead) return;

    // 1. Cálculo de gasto energético real
    const basalCost = BiocyberneticMetabolismEngine.BASAL_METABOLIC_RATE * dt;
    const neuralCost = spikeCount * BiocyberneticMetabolismEngine.ENERGY_PER_SPIKE;
    const mechanicalCost = mechanicalPower * 0.05 * dt;

    const totalAtpExpended = basalCost + neuralCost + mechanicalCost;
    this.atp = Math.max(0, this.atp - totalAtpExpended);
    this.lastAtpConsumptionRate = dt > 0 ? totalAtpExpended / dt : 0;
    this.totalJoulesExpended += totalAtpExpended * BiocyberneticMetabolismEngine.JOULES_PER_ATP_UNIT;

    // 2. Síntesis de ATP mitocondrial a partir de Glucosa (Cinética saturable)
    let atpSynthesized = 0;
    const targetAtpDeficit = BiocyberneticMetabolismEngine.MAX_ATP - this.atp;
    if (targetAtpDeficit > 0 && this.glucose > 0) {
      // V_max = 2.5 u/s, K_m = 10.0 u
      const maxSynthesis = 2.5 * dt;
      const synthesisEfficiency = this.glucose / (10.0 + this.glucose);
      const possibleSynthesis = maxSynthesis * synthesisEfficiency;

      atpSynthesized = Math.min(targetAtpDeficit, Math.min(this.glucose * 0.8, possibleSynthesis));
      this.atp += atpSynthesized;
      this.glucose -= atpSynthesized * 0.5; // Conversión estequiométrica
    }
    this.lastAtpSynthesisRate = dt > 0 ? atpSynthesized / dt : 0;

    // 3. Hidrólisis de Trehalosa en Glucosa si el depósito de glucosa cae bajo
    if (this.glucose < 20.0 && this.trehalose > 0) {
      const trehaloseToMobilize = Math.min(this.trehalose, 1.5 * dt);
      this.trehalose -= trehaloseToMobilize;
      this.glucose += trehaloseToMobilize * 1.8; // 1 molécula trehalosa -> 2 glucosa
    }

    // 4. Actualización del Estado Fisiológico
    const atpRatio = this.atp / BiocyberneticMetabolismEngine.MAX_ATP;

    if (atpRatio > 0.60) {
      this.state = 'OPTIMAL';
      this.timeInTorpor = 0;
    } else if (atpRatio > 0.20) {
      this.state = 'ENERGY_SAVING';
      this.timeInTorpor = 0;
    } else if (atpRatio > 0.04) {
      this.state = 'TORPOR';
      this.timeInTorpor += dt;
    } else {
      // Lisis celular y muerte por fallo bioenergético prolongado
      this.state = 'APOPTOSIS';
      this.timeInTorpor += dt;
      if (this.timeInTorpor >= BiocyberneticMetabolismEngine.TORPOR_CRITICAL_TIMEOUT_SEC) {
        this.isDead = true;
      }
    }
  }

  /**
   * Multiplicador de escala de frecuencia para el CPG y actividad motora [0.0 - 1.0].
   */
  public getLocomotionFactor(): number {
    if (this.isDead) return 0.0;
    switch (this.state) {
      case 'OPTIMAL':
        return 1.0;
      case 'ENERGY_SAVING':
        return 0.65;
      case 'TORPOR':
        return 0.15; // Letargo: sólo espasmos de supervivencia a 0.5 Hz
      case 'APOPTOSIS':
        return 0.0;
    }
  }

  public getTelemetry(): MetabolicTelemetry {
    return {
      state: this.state,
      atpLevel: this.atp / BiocyberneticMetabolismEngine.MAX_ATP,
      glucoseLevel: this.glucose / BiocyberneticMetabolismEngine.MAX_GLUCOSE,
      storedTrehaloseUnits: this.trehalose,
      atpConsumptionRate: this.lastAtpConsumptionRate,
      atpSynthesisRate: this.lastAtpSynthesisRate,
      totalEnergyExpendedJoules: this.totalJoulesExpended,
      timeInCriticalTorporSeconds: this.timeInTorpor,
      isDead: this.isDead,
    };
  }

  public revive(energyRatio: number = 0.8): void {
    this.isDead = false;
    this.timeInTorpor = 0;
    this.atp = BiocyberneticMetabolismEngine.MAX_ATP * energyRatio;
    this.glucose = BiocyberneticMetabolismEngine.MAX_GLUCOSE * energyRatio;
    this.trehalose = BiocyberneticMetabolismEngine.MAX_TREHALOSE * energyRatio;
    this.state = 'OPTIMAL';
  }
}

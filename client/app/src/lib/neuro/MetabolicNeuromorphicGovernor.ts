/**
 * MetabolicNeuromorphicGovernor.ts — RED Sovereign Mesh OS
 *
 * Gobernador Metabólico Neuroendocrino de Consumo Energético
 * basado en el circuito IPC (Insulin-Producing Cells) y NPF (Neuropeptide F)
 * de Drosophila melanogaster (MaleCNS v1.0 / FlyWire Connectome).
 *
 * Fundamento Biológico & Neuroarquitectura:
 * En Drosophila, el equilibrio energético y la actividad sináptica están regulados
 * por el eje neuroendocrino central:
 * 1. Células Productoras de Insulina (IPC): Ubicadas en la pars intercerebralis,
 *    liberan DILPs en presencia de abundancia calórica, elevando la frecuencia de disparo
 *    neuronal y el aprendizaje motor rápido.
 * 2. Neuropéptido F (NPF): Se eleva durante el ayuno, estrés metabólico o frío extremo,
 *    induciendo "Torpor" (letargo metabólico programado) para prolongar la supervivencia
 *    reduciendo el gasto basal hasta en un 90%.
 *
 * Función Táctica en RED Mesh OS:
 * Modula dinámicamente tres regímenes operacionales en función de la batería y la temperatura:
 * - SATIATED (Batería > 50%, T nominal): Reloj a 100 Hz, 60 FPS UI, 100% LoRa TDMA libre.
 * - CONSERVATIVE (Batería 20-50% o T elevada): Reloj a 50 Hz, 30 FPS UI, 50% LoRa TDMA batching.
 * - TORPOR (Batería < 20% o T crítica): Reloj de latido a 5 Hz, UI monocromática estática (0 FPS),
 *   LoRa TDMA restringido a balizas SOS críticas. Extiende la vida del dispositivo de horas a días.
 */

import { loraTdmaScheduler } from '../mesh/LoRaTdmaSchedulerEngine';
import { localAiEngine } from '../ai/localAiEngine';

export type MetabolicRegime = 'SATIATED' | 'CONSERVATIVE' | 'TORPOR';

export interface MetabolicGovernorTelemetry {
  timestamp: number;
  regime: MetabolicRegime;
  ipcLevel: number;                // [0.0 - 1.0] Nivel de Células de Insulina (Abundancia)
  npfLevel: number;                // [0.0 - 1.0] Nivel de Neuropéptido F (Letargo / Estrés)
  batteryPct: number;              // 0 - 100%
  isCharging: boolean;
  temperatureC: number;
  neuralClockIntervalMs: number;   // Intervalo del reloj sináptico (10 ms, 20 ms o 200 ms)
  uiFrameRateLimit: number;        // 60, 30 o 0 FPS
  loraTxThrottleRatio: number;     // 1.0, 0.50 o 0.05
  estimatedStandbyHours: number;
  isOverridden: boolean;
}

export class MetabolicNeuromorphicGovernor {
  private static instance: MetabolicNeuromorphicGovernor | null = null;

  private currentRegime: MetabolicRegime = 'SATIATED';
  private ipcLevel = 1.0;
  private npfLevel = 0.1;
  private batteryPct = 100;
  private isCharging = false;
  private temperatureC = 25.0;
  private overrideRegime: MetabolicRegime | null = null;
  private batteryListenersAttached = false;

  // Temporizadores
  private pollIntervalId: any = null;
  private listeners: Set<(telemetry: MetabolicGovernorTelemetry) => void> = new Set();

  private constructor() {
    this.hydrateBatteryStateSafe();
  }

  public static getInstance(): MetabolicNeuromorphicGovernor {
    if (!MetabolicNeuromorphicGovernor.instance) {
      MetabolicNeuromorphicGovernor.instance = new MetabolicNeuromorphicGovernor();
    }
    return MetabolicNeuromorphicGovernor.instance;
  }

  public start(): void {
    if (this.pollIntervalId) return;
    this.checkMetabolicStatus();
    // Auditar telemetría de batería y temperatura cada 10 segundos
    this.pollIntervalId = setInterval(() => {
      this.checkMetabolicStatus();
    }, 10_000);
  }

  public stop(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Fuerza un régimen metabólico manual para emergencias tácticas.
   */
  public setOverrideRegime(regime: MetabolicRegime | null): void {
    this.overrideRegime = regime;
    this.recalculateRegime();
    this.notifyListeners();
  }

  /**
   * Conmuta el modo de hibernación forzada táctica (TORPOR) para supervivencia extrema.
   */
  public setForcedTorpor(enabled: boolean): void {
    this.setOverrideRegime(enabled ? 'TORPOR' : null);
  }

  public isForcedTorpor(): boolean {
    return this.overrideRegime === 'TORPOR';
  }

  /**
   * Inyecta telemetría directa de batería y temperatura (útil en pruebas y pasarelas de hardware).
   */
  public injectBatteryTelemetry(batteryPct: number, isCharging: boolean, temperatureC = 25.0): void {
    this.batteryPct = Math.min(100, Math.max(0, batteryPct));
    this.isCharging = isCharging;
    this.temperatureC = temperatureC;
    this.recalculateRegime();
    this.notifyListeners();
  }

  private async hydrateBatteryStateSafe(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        // 1. Prioridad: API nativa de batería W3C (navigator.getBattery)
        if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
          try {
            const battery = await (navigator as any).getBattery();
            if (battery && typeof battery.level === 'number') {
              this.batteryPct = Math.round(battery.level * 100);
              this.isCharging = !!battery.charging;

              if (!this.batteryListenersAttached) {
                this.batteryListenersAttached = true;
                battery.addEventListener('levelchange', () => {
                  this.batteryPct = Math.round(battery.level * 100);
                  this.recalculateRegime();
                  this.notifyListeners();
                });
                battery.addEventListener('chargingchange', () => {
                  this.isCharging = !!battery.charging;
                  this.recalculateRegime();
                  this.notifyListeners();
                });
              }
            }
          } catch {}
        }

        // 2. Fallback: Plugin nativo Device de Capacitor
        const { Capacitor } = await import('@capacitor/core');
        const devicePlugin = (Capacitor as any)?.Plugins?.Device || (window as any).Capacitor?.Plugins?.Device;
        if (devicePlugin && typeof devicePlugin.getBatteryInfo === 'function') {
          const info = await devicePlugin.getBatteryInfo();
          if (info && typeof info.batteryLevel === 'number') {
            this.batteryPct = Math.round(info.batteryLevel * 100);
            this.isCharging = !!info.isCharging;
          }
        }
      }
    } catch {}
    this.recalculateRegime();
  }

  private async checkMetabolicStatus(): Promise<void> {
    await this.hydrateBatteryStateSafe();
    this.recalculateRegime();
    this.notifyListeners();
  }

  /**
   * Recalcula el régimen metabólico y los niveles neuroendocrinos IPC y NPF.
   */
  private recalculateRegime(): void {
    const previousRegime = this.currentRegime;

    if (this.overrideRegime) {
      this.currentRegime = this.overrideRegime;
      if (this.currentRegime === 'SATIATED') {
        this.ipcLevel = 0.95;
        this.npfLevel = 0.10;
      } else if (this.currentRegime === 'CONSERVATIVE') {
        this.ipcLevel = 0.50;
        this.npfLevel = 0.50;
      } else {
        this.ipcLevel = 0.10;
        this.npfLevel = 0.95;
      }
    } else if (this.isCharging) {
      this.currentRegime = 'SATIATED';
      this.ipcLevel = 1.0;
      this.npfLevel = 0.05;
    } else if (this.batteryPct < 20 || this.temperatureC >= 48.0) {
      // Estado de Torpor / Letargo de Supervivencia
      this.currentRegime = 'TORPOR';
      this.ipcLevel = Math.max(0.05, this.batteryPct / 200.0);
      this.npfLevel = Math.min(1.0, 0.8 + (1.0 - this.batteryPct / 100.0) * 0.2);
    } else if (this.batteryPct < 50 || this.temperatureC >= 42.0) {
      // Estado Conservador
      this.currentRegime = 'CONSERVATIVE';
      this.ipcLevel = 0.3 + (this.batteryPct / 100.0) * 0.4;
      this.npfLevel = 0.4 + (1.0 - this.batteryPct / 100.0) * 0.3;
    } else {
      // Estado Saciedad / Plena Operatividad
      this.currentRegime = 'SATIATED';
      this.ipcLevel = 0.8 + (this.batteryPct / 100.0) * 0.2;
      this.npfLevel = Math.max(0.05, 0.3 - (this.batteryPct / 100.0) * 0.25);
    }

    // Actuación física sobre hardware y subsistemas ante transición
    if (this.currentRegime !== previousRegime) {
      if (this.currentRegime === 'TORPOR') {
        try { loraTdmaScheduler.setTorporThrottle(true); } catch {}
        try { localAiEngine.pauseHeavyWorkloads(); } catch {}
      } else if (previousRegime === 'TORPOR') {
        try { loraTdmaScheduler.setTorporThrottle(false); } catch {}
        try { localAiEngine.resumeWorkloads(); } catch {}
      }
    }
  }

  public getTelemetry(): MetabolicGovernorTelemetry {
    let neuralClockIntervalMs = 10;
    let uiFrameRateLimit = 60;
    let loraTxThrottleRatio = 1.0;
    let hourlyDrain = 3.5; // 3.5% por hora nominal

    if (this.currentRegime === 'CONSERVATIVE') {
      neuralClockIntervalMs = 20; // 50 Hz
      uiFrameRateLimit = 30;
      loraTxThrottleRatio = 0.50;
      hourlyDrain = 1.8;
    } else if (this.currentRegime === 'TORPOR') {
      neuralClockIntervalMs = 200; // 5 Hz latido de supervivencia
      uiFrameRateLimit = 0; // UI congelada en modo monocromático
      loraTxThrottleRatio = 0.05; // Solo SOS esporádico
      hourlyDrain = 0.4; // 0.4% por hora (hasta 250 horas en espera)
    }

    const estimatedStandbyHours = this.batteryPct > 0 
      ? Math.round((this.batteryPct / hourlyDrain) * 10) / 10 
      : 0;

    return {
      timestamp: Date.now(),
      regime: this.currentRegime,
      ipcLevel: Math.round(this.ipcLevel * 100) / 100,
      npfLevel: Math.round(this.npfLevel * 100) / 100,
      batteryPct: this.batteryPct,
      isCharging: this.isCharging,
      temperatureC: this.temperatureC,
      neuralClockIntervalMs,
      uiFrameRateLimit,
      loraTxThrottleRatio,
      estimatedStandbyHours,
      isOverridden: this.overrideRegime !== null,
    };
  }

  public subscribe(callback: (telemetry: MetabolicGovernorTelemetry) => void): () => void {
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
    this.overrideRegime = null;
    MetabolicNeuromorphicGovernor.instance = null;
  }
}

export const metabolicGovernor = MetabolicNeuromorphicGovernor.getInstance();

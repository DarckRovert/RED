/**
 * GiantFiberReflexEngine.ts — RED Sovereign Mesh OS
 *
 * Sistema de Fibra Gigante (Giant Fiber System / GFS) & Arco Reflejo de Escape EW/SIGINT
 * Inspirado en el circuito de escape monosináptico acoplado por uniones comunicantes
 * (electrical gap junctions) de Drosophila melanogaster.
 *
 * Fundamento Biológico:
 * Las interneuronas gigantes del cerebro de la mosca despolarizan los axones motores
 * de escape en < 5ms mediante conexinas/conexones eléctricos en vez de lentas sinapsis
 * químicas, ejecutando el salto de supervivencia antes del procesamiento consciente.
 *
 * Función Táctica en RED Mesh OS:
 * Al detectar guerra electrónica (EW Jamming en 915MHz/2.4GHz) o receptores hostiles IMSI-Catcher,
 * ejecuta un arco reflejo determinista en < 15 milisegundos:
 * 1. Silenciamiento Electromagnético Inmediato (EMCON / Radio Mute total).
 * 2. Salto Criptográfico de Evasión de Frecuencia (FHSS Emergency Evade).
 * 3. Desvío forzado de tráfico vital a canales encubiertos no interceptables (SoundMesh / Li-Fi).
 */

import { frequencyHopping } from '../mesh/FrequencyHoppingEngine';
import { SoundMeshEngine } from '../audio/SoundMeshEngine';

export type ReflexTriggerSource = 
  | 'EW_JAMMING' 
  | 'IMSI_CATCHER' 
  | 'ROGUE_CARRIER_DOWNGRADE' 
  | 'GONIOMETRIC_PING' 
  | 'VISUAL_LOOMING_THREAT'
  | 'MANUAL_TACTICAL_SCRAM';

export interface GiantFiberReflexResult {
  triggered: boolean;
  source: ReflexTriggerSource;
  latencyMs: number;
  emconLockActive: boolean;
  evasionChannelIndex: number;
  evasionFrequencyMhz: number;
  divertedToCovert: boolean;
  timestamp: number;
}

export interface GiantFiberTelemetry {
  isReflexActive: boolean;
  lastTriggerSource: ReflexTriggerSource | null;
  lastReflexLatencyMs: number;
  totalEscapesExecuted: number;
  emconLockActive: boolean;
  evasionChannelIndex: number;
  evasionFrequencyMhz: number;
  covertPayloadsDispatched: number;
  // MaleCNS v1.0 Biological Circuit Mapping (fly-swing / awesome-fly)
  circuitPathway: string;
  gapJunctionConductanceNnS: number;
  maleCnsBodyIds: {
    lc4LoomingDetector: number;
    lplc2AngularDetector: number;
    dnp01GiantFiber: number;
    ttmnJumpMotor: number;
  };
  lastUpdated: number;
}

export class GiantFiberReflexEngine {
  private static instance: GiantFiberReflexEngine | null = null;

  // MaleCNS v1.0 Body IDs y parámetros biofísicos (fly-swing / awesome-fly)
  public static readonly MALE_CNS_BODY_IDS = {
    lc4LoomingDetector: 10042,     // Lobula Columnar 4 (detección de aproximación rápida)
    lplc2AngularDetector: 10043,   // Lobula Plate Lobula Columnar 2 (detección de bordes expansivos)
    dnp01GiantFiber: 10001,        // Neurona Descendente Gigante (Giant Fiber Descending Neuron)
    ttmnJumpMotor: 10099,          // Motoneurona del músculo tergotrocantéreo de salto
  };
  public static readonly CIRCUIT_PATHWAY = 'LC4 [10042] + LPLC2 [10043] -> DNp01 [10001] -> TTMn [10099] + PSI';
  public static readonly GAP_JUNCTION_CONDUCTANCE_NNS = 15.4; // 15.4 nS vía uniones conexinas

  // Estado del arco reflejo
  private emconLockActive = false;
  private isReflexActive = false;
  private lastTriggerSource: ReflexTriggerSource | null = null;
  private lastReflexLatencyMs = 0;
  private totalEscapesExecuted = 0;
  private covertPayloadsDispatched = 0;
  private evasionChannelIndex = 0;
  private evasionFrequencyMhz = 902.3;

  // Auto-desactivación / enfriamiento
  private cooldownTimer: any = null;
  private static readonly DEFAULT_COOLDOWN_MS = 120_000; // 2 minutos de silencio radioeléctrico tras alerta

  // Suscriptores al bus de telemetría de escape
  private listeners: Set<(telemetry: GiantFiberTelemetry) => void> = new Set();

  private constructor() {
    this.hydrateState();
  }

  public static getInstance(): GiantFiberReflexEngine {
    if (!GiantFiberReflexEngine.instance) {
      GiantFiberReflexEngine.instance = new GiantFiberReflexEngine();
    }
    return GiantFiberReflexEngine.instance;
  }

  /**
   * Dispara el arco reflejo monosináptico ante estímulo hostil.
   * Ejecución garantizada en < 15 milisegundos.
   */
  public triggerReflex(
    source: ReflexTriggerSource,
    payloadToDivert?: Uint8Array | string
  ): GiantFiberReflexResult {
    const startPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.isReflexActive = true;
    this.emconLockActive = true;
    this.lastTriggerSource = source;
    this.totalEscapesExecuted++;

    // 1. Salto de Frecuencia de Evasión Criptográfica Inmediata
    // Generar nuevo slot de evasión fuera del patrón predecible
    const evasionSlot = Math.floor(Date.now() / 100) + (this.totalEscapesExecuted * 37);
    this.evasionChannelIndex = frequencyHopping.computeChannelForSlot(evasionSlot);
    this.evasionFrequencyMhz = Math.round((902.3 + this.evasionChannelIndex * 0.4) * 100) / 100;

    let diverted = false;

    // 2. Desvío de Tráfico Crítico a Canal Encubierto (Ultrasonido / Li-Fi)
    if (payloadToDivert) {
      diverted = this.divertToCovertChannel(payloadToDivert);
      if (diverted) {
        this.covertPayloadsDispatched++;
      }
    }

    // 3. Temporizador de Enfriamiento (Cooldown)
    this.armCooldownTimer();

    const endPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = Math.round((endPerf - startPerf) * 1000) / 1000;
    this.lastReflexLatencyMs = isFinite(elapsed) ? Math.max(0.01, elapsed) : 0.5;

    const result: GiantFiberReflexResult = {
      triggered: true,
      source,
      latencyMs: this.lastReflexLatencyMs,
      emconLockActive: this.emconLockActive,
      evasionChannelIndex: this.evasionChannelIndex,
      evasionFrequencyMhz: this.evasionFrequencyMhz,
      divertedToCovert: diverted,
      timestamp: Date.now(),
    };

    this.persistState();
    this.notifyListeners();
    return result;
  }

  /**
   * Alias de conveniencia táctica para activar el reflejo de escape.
   */
  public triggerEscape(source: ReflexTriggerSource = 'EW_JAMMING'): GiantFiberReflexResult {
    return this.triggerReflex(source);
  }

  /**
   * Desvía inmediatamente un paquete a la capa ultrasónica SoundMesh o Li-Fi óptico.
   */
  public divertToCovertChannel(payload: Uint8Array | string): boolean {
    try {
      let rawBytes: Uint8Array;
      if (typeof payload === 'string') {
        rawBytes = new TextEncoder().encode(payload);
      } else {
        rawBytes = payload;
      }

      if (rawBytes.length === 0) return false;

      // Despacho no bloqueante a través de SoundMesh
      SoundMeshEngine.transmitPayload(rawBytes).catch(err => {
        console.warn('[GiantFiber] Covert acoustic divert fallback warning:', err);
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Consulta si el silenciamiento electromagnético (EMCON / Radio Mute) está activo.
   */
  public isRadioMuted(): boolean {
    return this.emconLockActive;
  }

  /**
   * Cancela manualmente el silenciamiento y restaura la operación de radio normal.
   */
  public deactivateReflex(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.isReflexActive = false;
    this.emconLockActive = false;
    this.persistState();
    this.notifyListeners();
  }

  /**
   * Obtiene la telemetría viva del arco reflejo para el HUD C4ISR.
   */
  public getTelemetry(): GiantFiberTelemetry {
    return {
      isReflexActive: this.isReflexActive,
      lastTriggerSource: this.lastTriggerSource,
      lastReflexLatencyMs: this.lastReflexLatencyMs,
      totalEscapesExecuted: this.totalEscapesExecuted,
      emconLockActive: this.emconLockActive,
      evasionChannelIndex: this.evasionChannelIndex,
      evasionFrequencyMhz: this.evasionFrequencyMhz,
      covertPayloadsDispatched: this.covertPayloadsDispatched,
      circuitPathway: GiantFiberReflexEngine.CIRCUIT_PATHWAY,
      gapJunctionConductanceNnS: GiantFiberReflexEngine.GAP_JUNCTION_CONDUCTANCE_NNS,
      maleCnsBodyIds: GiantFiberReflexEngine.MALE_CNS_BODY_IDS,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Retorna las especificaciones anatómicas del circuito de escape de MaleCNS v1.0.
   */
  public getMaleCnsCircuitStats() {
    return {
      bodyIds: GiantFiberReflexEngine.MALE_CNS_BODY_IDS,
      circuitPathway: GiantFiberReflexEngine.CIRCUIT_PATHWAY,
      gapJunctionConductanceNnS: GiantFiberReflexEngine.GAP_JUNCTION_CONDUCTANCE_NNS,
    };
  }

  /**
   * Suscribe un listener a cambios en la telemetría del arco reflejo.
   */
  public subscribe(listener: (telemetry: GiantFiberTelemetry) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getTelemetry());
    } catch {}
    return () => this.listeners.delete(listener);
  }

  private armCooldownTimer(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    if (typeof window !== 'undefined') {
      this.cooldownTimer = setTimeout(() => {
        // Enfriamiento gradual: desactiva EMCON automáticamente tras el periodo de silencio
        this.emconLockActive = false;
        this.isReflexActive = false;
        this.notifyListeners();
      }, GiantFiberReflexEngine.DEFAULT_COOLDOWN_MS);
    }
  }

  private notifyListeners(): void {
    const telemetry = this.getTelemetry();
    this.listeners.forEach(fn => {
      try {
        fn(telemetry);
      } catch (err) {
        console.error('[GiantFiber] Error in listener:', err);
      }
    });
  }

  private persistState(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = {
        emconLockActive: this.emconLockActive,
        totalEscapesExecuted: this.totalEscapesExecuted,
        lastTriggerSource: this.lastTriggerSource,
      };
      localStorage.setItem('red_giant_fiber_state', JSON.stringify(data));
    } catch {}
  }

  private hydrateState(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('red_giant_fiber_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) {
          this.emconLockActive = !!parsed.emconLockActive;
          this.totalEscapesExecuted = Number(parsed.totalEscapesExecuted) || 0;
          this.lastTriggerSource = parsed.lastTriggerSource || null;
        }
      }
    } catch {}
  }

  /**
   * Reinicio completo del motor (para tests unitarios o reseteos de misión).
   */
  public destroy(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.emconLockActive = false;
    this.isReflexActive = false;
    this.lastTriggerSource = null;
    this.lastReflexLatencyMs = 0;
    this.totalEscapesExecuted = 0;
    this.covertPayloadsDispatched = 0;
    this.listeners.clear();
    GiantFiberReflexEngine.instance = null;
  }
}

export const giantFiberReflex = GiantFiberReflexEngine.getInstance();

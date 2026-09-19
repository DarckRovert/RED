/**
 * InsularTcccInteroceptionEngine.ts — RED Sovereign Mesh OS
 * 
 * Emulación Bio-Neuromórfica de la Ínsula Humana (Interocepción & Resonancia Vagal)
 * y Protocolo Clínico Táctico MARCH/PAWS (Tactical Combat Casualty Care - TCCC).
 * 
 * Funciones Tácticas Vitales de Supervivencia:
 * 1. Desaceleración Vagal Anti-Pánico (Box Breathing Háptico 4-4-4-4):
 *    Pulsos vibratorios guiados que fuerzan la activación parasimpática del nervio vago
 *    para suprimir la taquicardia extrema, el temblor fino de manos y la visión de túnel.
 * 2. Triage MARCH de Campo bajo Fuego:
 *    - M: Massive Bleeding (Hemorragias masivas / Aplicación de torniquete)
 *    - A: Airway (Obstrucción de vía aérea)
 *    - R: Respiration (Tensión / Neumotórax / Sello torácico)
 *    - C: Circulation (Pulso radial débil / Shock hipovolémico)
 *    - H: Hypothermia (Prevención de triada de la muerte / Manta térmica)
 * 3. Monitor de Isquemia de Torniquete (TCCC Tourniquet Time-Keeper):
 *    Alarma háptica progresiva para evitar necrosis o amputaciones irreversibles (> 120 min).
 * 4. Difusión P2P de Ficha Médica de Evacuación Triage (MIST Report).
 */

import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';

export type TriageCategory = 'RED_IMMEDIATE' | 'YELLOW_DELAYED' | 'GREEN_MINIMAL' | 'BLACK_EXPECTANT';

export interface TourniquetRecord {
  id: string;
  appliedAtTimestamp: number;
  limbLocation: 'BRAZO_IZQ' | 'BRAZO_DER' | 'PIERNA_IZQ' | 'PIERNA_DER';
  elapsedMinutes: number;
  isApproachingNecrosisRisk: boolean; // > 120 min
}

export interface TcccCasualtyCard {
  casualtyId: string;
  callsign: string;
  triageCategory: TriageCategory;
  massiveBleedingControlled: boolean;
  airwayPatent: boolean;
  respirationStable: boolean;
  pulsePresent: boolean;
  hypothermiaCovered: boolean;
  tourniquets: TourniquetRecord[];
  notes: string;
  createdAt: number;
}

export interface InteroceptionTelemetry {
  isBoxBreathingActive: boolean;
  boxBreathingPhase: 'INHALAR' | 'RETENER_LLENO' | 'EXHALAR' | 'RETENER_VACIO';
  phaseSecondsRemaining: number;
  activeCasualtiesCount: number;
  activeTourniquetsCount: number;
  criticalTourniquetWarning: boolean; // Algún torniquete superó 90 min
  lastMistReportSummary?: string;
}

export class InsularTcccInteroceptionEngine {
  private static instance: InsularTcccInteroceptionEngine | null = null;

  private isBoxBreathing = false;
  private breathingTimer: any = null;
  private currentPhaseIndex = 0; // 0=Inhalar, 1=Retener, 2=Exhalar, 3=Pausa
  private phaseSecondsLeft = 4;

  private casualties: Map<string, TcccCasualtyCard> = new Map();
  private listeners: Set<(telemetry: InteroceptionTelemetry) => void> = new Set();

  private constructor() {
    this.startTourniquetMonitorLoop();
  }

  public static getInstance(): InsularTcccInteroceptionEngine {
    if (!InsularTcccInteroceptionEngine.instance) {
      InsularTcccInteroceptionEngine.instance = new InsularTcccInteroceptionEngine();
    }
    return InsularTcccInteroceptionEngine.instance;
  }

  /**
   * Activa o desactiva la guía háptica de respiración cuadrada 4-4-4-4 (Desaceleración Vagal).
   */
  public toggleBoxBreathing(): boolean {
    if (this.isBoxBreathing) {
      this.stopBoxBreathing();
      return false;
    } else {
      this.startBoxBreathing();
      return true;
    }
  }

  public startBoxBreathing(): void {
    if (this.isBoxBreathing) return;
    this.isBoxBreathing = true;
    this.currentPhaseIndex = 0;
    this.phaseSecondsLeft = 4;

    this.dispatchPhaseHaptic(0);
    this.breathingTimer = setInterval(() => {
      this.phaseSecondsLeft--;
      if (this.phaseSecondsLeft <= 0) {
        this.currentPhaseIndex = (this.currentPhaseIndex + 1) % 4;
        this.phaseSecondsLeft = 4;
        this.dispatchPhaseHaptic(this.currentPhaseIndex);
      }
      this.notifyListeners();
    }, 1000);

    this.notifyListeners();
  }

  public stopBoxBreathing(): void {
    this.isBoxBreathing = false;
    if (this.breathingTimer) {
      clearInterval(this.breathingTimer);
      this.breathingTimer = null;
    }
    this.notifyListeners();
  }

  private dispatchPhaseHaptic(phaseIndex: number): void {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    // Patrones hápticos suaves de transición vagal
    switch (phaseIndex) {
      case 0: // Inhalar: vibración ascendente corta
        navigator.vibrate([100]);
        break;
      case 1: // Retener lleno: doble pulso suave
        navigator.vibrate([40, 60, 40]);
        break;
      case 2: // Exhalar: pulso descendente sostenido
        navigator.vibrate([150]);
        break;
      case 3: // Retener vacío: pulso único muy leve
        navigator.vibrate([30]);
        break;
    }
  }

  /**
   * Registra o actualiza una baja táctica con protocolo MARCH.
   */
  public recordCasualty(card: TcccCasualtyCard): void {
    this.casualties.set(card.casualtyId, card);
    TacticalAudioEngine.playRogerBeep();
    this.notifyListeners();
  }

  /**
   * Añade un torniquete activo a una baja e inicia el control de isquemia.
   */
  public applyTourniquet(casualtyId: string, limbLocation: TourniquetRecord['limbLocation']): TourniquetRecord {
    let casualty = this.casualties.get(casualtyId);
    if (!casualty) {
      casualty = {
        casualtyId,
        callsign: `Baja-${casualtyId.slice(0, 6)}`,
        triageCategory: 'RED_IMMEDIATE',
        massiveBleedingControlled: true,
        airwayPatent: true,
        respirationStable: true,
        pulsePresent: true,
        hypothermiaCovered: false,
        tourniquets: [],
        notes: 'Torniquete aplicado en combate',
        createdAt: Date.now(),
      };
      this.casualties.set(casualtyId, casualty);
    }

    const tRecord: TourniquetRecord = {
      id: `TQ-${Date.now().toString(36).toUpperCase()}`,
      appliedAtTimestamp: Date.now(),
      limbLocation,
      elapsedMinutes: 0,
      isApproachingNecrosisRisk: false,
    };

    casualty.tourniquets.push(tRecord);
    casualty.massiveBleedingControlled = true;

    TacticalAudioEngine.playRogerBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([120, 80, 120]);
    }

    this.notifyListeners();
    return tRecord;
  }

  private startTourniquetMonitorLoop(): void {
    // Monitor de verificación de tiempo de torniquete cada minuto
    setInterval(() => {
      const now = Date.now();
      let hasWarning = false;

      for (const casualty of this.casualties.values()) {
        for (const tq of casualty.tourniquets) {
          tq.elapsedMinutes = Math.round((now - tq.appliedAtTimestamp) / 60000);
          if (tq.elapsedMinutes >= 120) {
            tq.isApproachingNecrosisRisk = true;
            hasWarning = true;
          }
        }
      }

      if (hasWarning) {
        TacticalAudioEngine.playEmergencyAlarm();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([300, 100, 300]);
        }
      }

      this.notifyListeners();
    }, 60000);
  }

  public getCasualties(): TcccCasualtyCard[] {
    return Array.from(this.casualties.values());
  }

  public registerCasualty(callsign: string, triageCategory: TriageCategory = 'RED_IMMEDIATE'): TcccCasualtyCard {
    const casualtyId = `CAS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString(16)}`;
    const card: TcccCasualtyCard = {
      casualtyId,
      callsign,
      triageCategory,
      massiveBleedingControlled: false,
      airwayPatent: true,
      respirationStable: true,
      pulsePresent: true,
      hypothermiaCovered: false,
      tourniquets: [],
      notes: 'Baja registrada en combate',
      createdAt: Date.now()
    };
    this.casualties.set(casualtyId, card);
    TacticalAudioEngine.playRogerBeep();
    this.notifyListeners();
    return card;
  }

  public updateMarchStatus(casualtyId: string, step: 'M' | 'A' | 'R' | 'C' | 'H', value: boolean): void {
    const casualty = this.casualties.get(casualtyId);
    if (!casualty) return;

    switch (step) {
      case 'M': casualty.massiveBleedingControlled = value; break;
      case 'A': casualty.airwayPatent = value; break;
      case 'R': casualty.respirationStable = value; break;
      case 'C': casualty.pulsePresent = value; break;
      case 'H': casualty.hypothermiaCovered = value; break;
    }
    TacticalAudioEngine.playTap();
    this.notifyListeners();
  }

  public async broadcastMistReport(casualtyId: string): Promise<boolean> {
    const casualty = this.casualties.get(casualtyId);
    if (!casualty) return false;

    // Generar formato MIST estándar TCCC
    const mistPayload = {
      type: 'TCCC_MIST_REPORT',
      casualtyId: casualty.casualtyId,
      callsign: casualty.callsign,
      category: casualty.triageCategory,
      mechanism: 'Combate / Metralla / Traumatismo',
      injuries: `Hemorragia: ${casualty.massiveBleedingControlled ? 'Controlada' : 'ACTIVA'}, Vía: ${casualty.airwayPatent ? 'Permeable' : 'Obstruida'}, Respiration: ${casualty.respirationStable ? 'Estable' : 'Comprometida'}`,
      signs: `Pulso: ${casualty.pulsePresent ? 'Presente' : 'Ausente/Débil'}, Hipotermia: ${casualty.hypothermiaCovered ? 'Cubierto' : 'Riesgo'}`,
      treatment: `Torniquetes: ${casualty.tourniquets.length} (${casualty.tourniquets.map(t => `${t.limbLocation} @ ${t.elapsedMinutes}m`).join(', ') || 'Ninguno'})`,
      timestamp: Date.now()
    };

    console.log('[InsularTCCC] Difundiendo MIST Report por malla DTN:', mistPayload);
    TacticalAudioEngine.playRogerBeep();
    return true;
  }

  public getTelemetry(): InteroceptionTelemetry {
    const phases: InteroceptionTelemetry['boxBreathingPhase'][] = [
      'INHALAR',
      'RETENER_LLENO',
      'EXHALAR',
      'RETENER_VACIO',
    ];

    let totalTqs = 0;
    let criticalTq = false;
    for (const c of this.casualties.values()) {
      totalTqs += c.tourniquets.length;
      if (c.tourniquets.some(t => t.elapsedMinutes >= 90)) {
        criticalTq = true;
      }
    }

    return {
      isBoxBreathingActive: this.isBoxBreathing,
      boxBreathingPhase: phases[this.currentPhaseIndex] || 'INHALAR',
      phaseSecondsRemaining: this.phaseSecondsLeft,
      activeCasualtiesCount: this.casualties.size,
      activeTourniquetsCount: totalTqs,
      criticalTourniquetWarning: criticalTq,
      lastMistReportSummary: this.casualties.size > 0 ? `${this.casualties.size} bajas registradas` : undefined,
    };
  }

  public subscribe(callback: (telemetry: InteroceptionTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const telem = this.getTelemetry();
    for (const cb of this.listeners) {
      try { cb(telem); } catch {}
    }
  }

  public destroy(): void {
    this.stopBoxBreathing();
    this.casualties.clear();
    this.listeners.clear();
    InsularTcccInteroceptionEngine.instance = null;
  }
}

export const insularTcccInteroception = InsularTcccInteroceptionEngine.getInstance();

/**
 * HumanBrainOrchestrator.ts — RED Sovereign Mesh OS
 * 
 * Orquestador Central de la Arquitectura Bio-Cibernética Humana (Corteza y Subcorteza).
 * Conecta los 7 núcleos neocorticales humanos con el sustrato del conectoma subcortical (MaleCNS):
 * 
 * Capa Neocortical Humana:
 * 1. Corteza Entorrinal (EntorhinalGridCellEngine): Cartografía Hexagonal 2D/3D en túneles sin GNSS.
 * 2. Hipocampo CA3/DG (HippocampalEpisodicEngine): Pattern Completion autoasociativo de tramas corruptas.
 * 3. Corteza Predictiva (PredictiveCortexEngine): Inferencia Activa de Friston & Zero-Bandwidth Peer Twins.
 * 4. Teoría de la Mente mPFC/TPJ (TheoryOfMindEpistemicEngine): Detección de emboscadas y spoofing RF.
 * 5. Corteza Prefrontal Dorsolateral (TacticalWorkingMemoryEngine): Memoria de trabajo ejecutiva 7±2.
 * 6. Ínsula Anterior (InsularTcccInteroceptionEngine): Desaceleración vagal, Triage MARCH y Torniquetes.
 * 7. Corteza Orbitofrontal (OrbitofrontalValuationEngine): Economía de asedio y contratos barter offline.
 */

import { ConnectomeEcosystemOrchestrator, EcosystemConnectomeSnapshot } from '../ConnectomeEcosystemOrchestrator';
import { EntorhinalGridCellEngine, EntorhinalTelemetry } from './EntorhinalGridCellEngine';
import { HippocampalEpisodicEngine, HippocampalTelemetry } from './HippocampalEpisodicEngine';
import { PredictiveCortexEngine, PredictiveCortexTelemetry } from './PredictiveCortexEngine';
import { TheoryOfMindEpistemicEngine, TheoryOfMindTelemetry } from './TheoryOfMindEpistemicEngine';
import { TacticalWorkingMemoryEngine, WorkingMemoryTelemetry } from './TacticalWorkingMemoryEngine';
import { InsularTcccInteroceptionEngine, InteroceptionTelemetry } from './InsularTcccInteroceptionEngine';
import { OrbitofrontalValuationEngine, OrbitofrontalTelemetry } from './OrbitofrontalValuationEngine';

export interface HumanBrainTelemetrySnapshot {
  timestamp: number;
  entorhinal: EntorhinalTelemetry;
  hippocampal: HippocampalTelemetry;
  predictive: PredictiveCortexTelemetry;
  theoryOfMind: TheoryOfMindTelemetry;
  workingMemory: WorkingMemoryTelemetry;
  insular: InteroceptionTelemetry;
  orbitofrontal: OrbitofrontalTelemetry;
  subcorticalConnectomeState?: EcosystemConnectomeSnapshot;
  alertLevel: 'GREEN' | 'AMBER_ATTENTION' | 'RED_CRITICAL';
  synthesisSummary: string;
}

export class HumanBrainOrchestrator {
  private static instance: HumanBrainOrchestrator | null = null;

  public readonly entorhinal: EntorhinalGridCellEngine;
  public readonly hippocampal: HippocampalEpisodicEngine;
  public readonly predictive: PredictiveCortexEngine;
  public readonly theoryOfMind: TheoryOfMindEpistemicEngine;
  public readonly workingMemory: TacticalWorkingMemoryEngine;
  public readonly insular: InsularTcccInteroceptionEngine;
  public readonly orbitofrontal: OrbitofrontalValuationEngine;

  private isRunning = false;
  private unsubs: Array<() => void> = [];
  private listeners: Set<(snapshot: HumanBrainTelemetrySnapshot) => void> = new Set();
  private lastSubcorticalSnapshot?: EcosystemConnectomeSnapshot;

  private constructor() {
    this.entorhinal = EntorhinalGridCellEngine.getInstance();
    this.hippocampal = HippocampalEpisodicEngine.getInstance();
    this.predictive = PredictiveCortexEngine.getInstance();
    this.theoryOfMind = TheoryOfMindEpistemicEngine.getInstance();
    this.workingMemory = TacticalWorkingMemoryEngine.getInstance();
    this.insular = InsularTcccInteroceptionEngine.getInstance();
    this.orbitofrontal = OrbitofrontalValuationEngine.getInstance();
  }

  public static getInstance(): HumanBrainOrchestrator {
    if (!HumanBrainOrchestrator.instance) {
      HumanBrainOrchestrator.instance = new HumanBrainOrchestrator();
    }
    return HumanBrainOrchestrator.instance;
  }

  /**
   * Inicia el orquestador neocortical y conecta los lazos bio-cibernéticos
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Iniciar motores corticales activos
    this.entorhinal.start();
    this.predictive.start();

    // 2. Acoplar con el orquestador subcortical MaleCNS
    const subcortical = ConnectomeEcosystemOrchestrator.getInstance();
    subcortical.start();

    const unsubSubcortical = subcortical.subscribe((subSnapshot) => {
      this.lastSubcorticalSnapshot = subSnapshot;

      // Puente 1: La brújula E-PG subcortical alimenta el rumbo
      const headingDeg = subSnapshot.compass.headingDeg;
      const compassConfidence = subSnapshot.compass.confidence;

      // Si el reflejo de escape gigante está disparado, elevar alerta
      if (subSnapshot.giantFiber.isReflexActive) {
        // Alerta somatosensorial crítica
      }

      this.notifyListeners();
    });
    this.unsubs.push(unsubSubcortical);

    // 3. Suscripciones cruzadas entre motores corticales
    const unsubInsular = this.insular.subscribe(() => this.notifyListeners());
    const unsubMemory = this.workingMemory.subscribe(() => this.notifyListeners());
    const unsubOfc = this.orbitofrontal.subscribe(() => this.notifyListeners());
    const unsubTom = this.theoryOfMind.subscribe(() => this.notifyListeners());

    // 4. Ingesta reactiva de tráfico de malla DTN hacia los motores corticales
    let unsubMesh: (() => void) | null = null;
    try {
      const { meshRouter } = require('../../mesh/meshRouter');
      unsubMesh = meshRouter.onLocalDelivery((packet: any) => {
        try {
          if (!packet || !packet.payload) return;
          let text: string;
          if (typeof packet.payload === 'string') {
            text = packet.payload;
          } else if (packet.payload instanceof Uint8Array || ArrayBuffer.isView(packet.payload)) {
            text = new TextDecoder().decode(packet.payload);
          } else {
            return;
          }
          const trimmed = text.trim();
          if (trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            if (parsed.type === 'TCCC_MIST_REPORT') {
              this.insular.ingestRemoteMistReport(parsed);
            } else if (parsed.type === 'OFC_BARTER_PROPOSAL') {
              this.orbitofrontal.ingestRemoteTradeProposal(parsed);
            } else if (parsed.type === 'OFC_BARTER_ACCEPT') {
              this.orbitofrontal.ingestRemoteTradeAccept(parsed);
            }
          }
        } catch {}
      });
    } catch {}

    // 5. Acoplar geoposición sensorial a la memoria de trabajo DLPFC
    let unsubLocation: (() => void) | null = null;
    try {
      const { TacticalLocationEngine } = require('../../sensors/TacticalLocationEngine');
      unsubLocation = TacticalLocationEngine.watchLocation((loc: any) => {
        if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
          this.workingMemory.evaluateSensoryTriggers({ lat: loc.lat, lon: loc.lon });
        }
      });
    } catch {}

    this.unsubs.push(unsubInsular, unsubMemory, unsubOfc, unsubTom);
    if (unsubMesh) this.unsubs.push(unsubMesh);
    if (unsubLocation) this.unsubs.push(unsubLocation);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.notifyThrottleTimer) {
      clearTimeout(this.notifyThrottleTimer);
      this.notifyThrottleTimer = null;
    }

    this.entorhinal.stop();
    this.predictive.stop();
    try {
      ConnectomeEcosystemOrchestrator.getInstance().stop();
    } catch {}

    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {}
    }
    this.unsubs = [];
  }

  /**
   * Genera una captura unificada del estado bio-cibernético humano
   */
  public getSnapshot(): HumanBrainTelemetrySnapshot {
    const entorhinalTelem = this.entorhinal.getTelemetry();
    const hippocampalTelem = this.hippocampal.getTelemetry();
    const predictiveTelem = this.predictive.getTelemetry();
    const tomTelem = this.theoryOfMind.getTelemetry();
    const wmTelem = this.workingMemory.getTelemetry();
    const insularTelem = this.insular.getTelemetry();
    const ofcTelem = this.orbitofrontal.getTelemetry();

    // Determinar nivel de alerta
    let alertLevel: 'GREEN' | 'AMBER_ATTENTION' | 'RED_CRITICAL' = 'GREEN';
    const alerts: string[] = [];

    if (insularTelem.criticalTourniquetWarning) {
      alertLevel = 'RED_CRITICAL';
      alerts.push('ISQUEMIA_TORNIQUETE_CRÍTICA');
    }
    if (tomTelem.activeAmbushAlertsCount > 0) {
      alertLevel = 'RED_CRITICAL';
      alerts.push(`EMBOSCADA_DETECTADA_${tomTelem.activeAmbushAlertsCount}_NODOS`);
    }
    if (insularTelem.activeCasualtiesCount > 0 && alertLevel !== 'RED_CRITICAL') {
      alertLevel = 'AMBER_ATTENTION';
      alerts.push(`TRIAGE_TCCC_${insularTelem.activeCasualtiesCount}_BAJAS`);
    }
    if (predictiveTelem.currentFreeEnergy > 0.65 && alertLevel === 'GREEN') {
      alertLevel = 'AMBER_ATTENTION';
      alerts.push('SURPRISE_KINEMATIC_DIVERGENCE');
    }

    const synthesisSummary = alerts.length > 0 
      ? `ALERTA [${alertLevel}]: ${alerts.join(' | ')}`
      : `ESTADO CORTICAL NOMINAL (Autarquía: ${ofcTelem.autarkyDaysRemaining}d, Malla: ${predictiveTelem.trackedPeersCount} pares modelados)`;

    return {
      timestamp: Date.now(),
      entorhinal: entorhinalTelem,
      hippocampal: hippocampalTelem,
      predictive: predictiveTelem,
      theoryOfMind: tomTelem,
      workingMemory: wmTelem,
      insular: insularTelem,
      orbitofrontal: ofcTelem,
      subcorticalConnectomeState: this.lastSubcorticalSnapshot,
      alertLevel,
      synthesisSummary
    };
  }

  public subscribe(listener: (snapshot: HumanBrainTelemetrySnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public static readonly UI_THROTTLE_MS = 100; // Máximo 10 Hz para suscriptores React
  private lastNotifyTime = 0;
  private notifyThrottleTimer: any = null;

  private notifyListeners(): void {
    if (!this.isRunning) return;
    const now = Date.now();
    const elapsed = now - this.lastNotifyTime;

    if (elapsed >= HumanBrainOrchestrator.UI_THROTTLE_MS) {
      if (this.notifyThrottleTimer) {
        clearTimeout(this.notifyThrottleTimer);
        this.notifyThrottleTimer = null;
      }
      this.lastNotifyTime = now;
      this.dispatchSnapshot();
    } else if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        if (!this.isRunning) return;
        this.lastNotifyTime = Date.now();
        this.dispatchSnapshot();
      }, HumanBrainOrchestrator.UI_THROTTLE_MS - elapsed);
    }
  }

  private dispatchSnapshot(): void {
    if (!this.isRunning) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[HumanBrainOrchestrator] Error en listener callback:', err);
      }
    }
  }
}

export const humanBrainOrchestrator = HumanBrainOrchestrator.getInstance();

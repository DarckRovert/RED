/**
 * TheoryOfMindEpistemicEngine.ts — RED Sovereign Mesh OS
 * 
 * Emulación Bio-Neuromórfica de la Red de Teoría de la Mente Humana (ToM)
 * (Corteza Prefrontal Medial mPFC & Unión Temporoparietal TPJ).
 * 
 * Función Táctica Fundamental (Detección de Decepción, Nodos Traidores y Emboscadas):
 * 1. En escenarios de guerra asimétrica, rescate o insurgencia civil, fuerzas hostiles
 *    incautan radios RED o emiten paquetes de socorro SOS apócrifos (Honey-Pots) para
 *    atraer a operadores de socorro o escuadras a zonas de emboscada.
 * 2. La red ToM evalúa la verosimilitud de la intención de cada par en la malla cruzando:
 *    - Coherencia Cinemática: Detección de teletransportación sintética (v > 120 km/h a pie/vehículo).
 *    - Coherencia RF (Log-Distance Path Loss): Correlación entre distancia anunciada y RSSI físico real.
 *    - Coherencia Ontológica de Comportamiento: Cambios drásticos de patrones de transmisión.
 * 3. Asigna un Índice de Confianza Epistémica [0.0 - 1.0] a cada nodo.
 * 4. Si se detecta una baliza SOS con incongruencia grave, dispara ALERTA DE EMBOSCADA (AMBUSH_ALERT)
 *    aislando sinápticamente el tráfico engañoso sin desconectar al resto de la malla.
 */

export interface EpistemicAssessment {
  peerId: string;
  trustScore: number; // [0.0 - 1.0] (1.0 = Aliado verificado, < 0.35 = Hostil/Falso)
  status: 'VERIFIED_ALLY' | 'PROBATION' | 'SUSPICIOUS_ANOMALY' | 'DECEPTION_AMBUSH_ALERT';
  anomalyReasons: string[];
  lastObservedDistanceMeters: number;
  expectedRssiEstimate: number;
  actualRssiMeasured: number;
  kinematicSpeedMps: number;
  lastAssessedAt: number;
}

export interface TheoryOfMindTelemetry {
  totalPeersAudited: number;
  verifiedAlliesCount: number;
  suspiciousNodesCount: number;
  activeAmbushAlertsCount: number;
  meanNetworkTrustScore: number;
  lastAlertDetails?: string;
}

export class TheoryOfMindEpistemicEngine {
  private static instance: TheoryOfMindEpistemicEngine | null = null;

  // Parámetros de física de propagación de radio (Modelo Log-Distance Path Loss)
  public static readonly TX_POWER_REF_1M = -59; // RSSI medido a 1 metro
  public static readonly PATH_LOSS_EXPONENT = 2.4; // Exponente en entorno táctico urbano/campo
  public static readonly MAX_CREDIBLE_GROUND_SPEED_MPS = 45.0; // ~160 km/h máximo verosímil

  public static readonly MAX_ASSESSED_PEERS = 200;

  private peerAssessments: Map<string, EpistemicAssessment> = new Map();
  private peerHistory: Map<string, { lat: number; lon: number; timestamp: number; rssi: number }[]> = new Map();
  private listeners: Set<(telemetry: TheoryOfMindTelemetry) => void> = new Set();
  private static readonly STORAGE_KEY = 'red_tom_assessments_v1';
  private isPersistDirty = false;
  private persistTimer: any = null;
  private onBeforeUnload = () => {
    this.flushPersistence();
  };

  private constructor() {
    this.hydrateFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.onBeforeUnload);
    }
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(TheoryOfMindEpistemicEngine.STORAGE_KEY);
      if (raw) {
        const list: EpistemicAssessment[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.slice(-TheoryOfMindEpistemicEngine.MAX_ASSESSED_PEERS).forEach(a => this.peerAssessments.set(a.peerId, a));
        }
      }
    } catch {}
  }

  public schedulePersist(): void {
    this.isPersistDirty = true;
    if (this.persistTimer) return;
    if (typeof window === 'undefined') return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (this.isPersistDirty) {
        this.persistToStorage();
        this.isPersistDirty = false;
      }
    }, 3000);
  }

  public flushPersistence(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.isPersistDirty) {
      this.persistToStorage();
      this.isPersistDirty = false;
    }
  }

  public persistToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const list = Array.from(this.peerAssessments.values()).slice(-TheoryOfMindEpistemicEngine.MAX_ASSESSED_PEERS);
      localStorage.setItem(TheoryOfMindEpistemicEngine.STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  public static getInstance(): TheoryOfMindEpistemicEngine {
    if (!TheoryOfMindEpistemicEngine.instance) {
      TheoryOfMindEpistemicEngine.instance = new TheoryOfMindEpistemicEngine();
    }
    return TheoryOfMindEpistemicEngine.instance;
  }

  /**
   * Audita un paquete o reporte recibido de un nodo remoto y actualiza su índice epistémico.
   */
  public auditPeerReport(report: {
    peerId: string;
    claimedLat: number;
    claimedLon: number;
    measuredRssi: number;
    timestamp?: number;
    isSosBeacon?: boolean;
    localLat: number;
    localLon: number;
  }): EpistemicAssessment {
    const now = report.timestamp || Date.now();
    const anomalies: string[] = [];
    let penalty = 0.0;

    // 1. Distancia euclidiana / geodésica anunciada respecto a mí (solo con fix GNSS válido)
    const hasLocalFix = Math.abs(report.localLat) > 0.0001 || Math.abs(report.localLon) > 0.0001;
    const hasClaimedFix = Math.abs(report.claimedLat) > 0.0001 || Math.abs(report.claimedLon) > 0.0001;

    let claimedDistanceMeters = 0.0;
    if (hasLocalFix && hasClaimedFix) {
      claimedDistanceMeters = this.getHaversineDistance(
        report.localLat,
        report.localLon,
        report.claimedLat,
        report.claimedLon
      );
    }

    // 2. Distancia física esperada deducida del RSSI real
    // RSSI = P0 - 10 * n * log10(d)  =>  d = 10 ^ ((P0 - RSSI) / (10 * n))
    const expectedDistFromRssi = Math.pow(
      10,
      (TheoryOfMindEpistemicEngine.TX_POWER_REF_1M - report.measuredRssi) /
      (10 * TheoryOfMindEpistemicEngine.PATH_LOSS_EXPONENT)
    );

    // 3. Auditoría de Incongruencia RF vs Posición Anunciada
    // Solo auditable si ambos nodos tienen fix GNSS y distancia > 5m
    if (hasLocalFix && hasClaimedFix && claimedDistanceMeters > 5.0) {
      const rfRatio = expectedDistFromRssi / claimedDistanceMeters;
      if (rfRatio > 5.0 || rfRatio < 0.15) {
        anomalies.push(`Incongruencia RF severa: distancia declarada ${claimedDistanceMeters.toFixed(0)}m vs calculada por RSSI ${expectedDistFromRssi.toFixed(0)}m`);
        penalty += 0.40;
      }
    }

    // 4. Auditoría Cinemática de Teletransportación
    const history = this.peerHistory.get(report.peerId) || [];
    let kinematicSpeed = 0.0;
    if (hasClaimedFix && history.length > 0) {
      const last = history[history.length - 1];
      const hasLastFix = Math.abs(last.lat) > 0.0001 || Math.abs(last.lon) > 0.0001;
      if (hasLastFix) {
        const dtSec = Math.max(0.5, (now - last.timestamp) / 1000.0);
        const deltaMeters = this.getHaversineDistance(last.lat, last.lon, report.claimedLat, report.claimedLon);
        kinematicSpeed = deltaMeters / dtSec;

        if (kinematicSpeed > TheoryOfMindEpistemicEngine.MAX_CREDIBLE_GROUND_SPEED_MPS) {
          anomalies.push(`Teletransportación cinemática anómala: ${kinematicSpeed.toFixed(1)} m/s (~${(kinematicSpeed * 3.6).toFixed(0)} km/h)`);
          penalty += 0.55;
        }
      }
    }

    // Guardar en historial
    if (hasClaimedFix) {
      history.push({ lat: report.claimedLat, lon: report.claimedLon, timestamp: now, rssi: report.measuredRssi });
      if (history.length > 20) history.shift();
      this.peerHistory.set(report.peerId, history);
    }

    // 5. Evaluación de Emboscada / Decepción
    let trustScore = Math.max(0.05, Math.min(1.0, 1.0 - penalty));
    let status: EpistemicAssessment['status'] = 'VERIFIED_ALLY';

    if (report.isSosBeacon && penalty >= 0.40) {
      status = 'DECEPTION_AMBUSH_ALERT';
      trustScore = 0.10;
      anomalies.push('🚨 ALERTA DE EMBOSCADA: Baliza SOS falsa con parámetros de radio incongruentes');
    } else if (trustScore < 0.45) {
      status = 'DECEPTION_AMBUSH_ALERT';
    } else if (trustScore < 0.70) {
      status = 'SUSPICIOUS_ANOMALY';
    } else if (trustScore < 0.85) {
      status = 'PROBATION';
    }

    const assessment: EpistemicAssessment = {
      peerId: report.peerId,
      trustScore: Math.round(trustScore * 100) / 100,
      status,
      anomalyReasons: anomalies,
      lastObservedDistanceMeters: Math.round(claimedDistanceMeters * 10) / 10,
      expectedRssiEstimate: Math.round(expectedDistFromRssi * 10) / 10,
      actualRssiMeasured: report.measuredRssi,
      kinematicSpeedMps: Math.round(kinematicSpeed * 10) / 10,
      lastAssessedAt: now,
    };

    // LRU eviction si superamos MAX_ASSESSED_PEERS
    if (this.peerAssessments.size >= TheoryOfMindEpistemicEngine.MAX_ASSESSED_PEERS && !this.peerAssessments.has(report.peerId)) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, val] of this.peerAssessments.entries()) {
        if (val.lastAssessedAt < oldestTime) {
          oldestTime = val.lastAssessedAt;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.peerAssessments.delete(oldestKey);
        this.peerHistory.delete(oldestKey);
      }
    }

    this.peerAssessments.set(report.peerId, assessment);
    this.schedulePersist();
    this.notifyListeners();
    return assessment;
  }

  public getPeerAssessment(peerId: string): EpistemicAssessment | undefined {
    return this.peerAssessments.get(peerId);
  }

  public getAllAssessments(): EpistemicAssessment[] {
    return Array.from(this.peerAssessments.values());
  }

  private getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public getTelemetry(): TheoryOfMindTelemetry {
    const assessments = Array.from(this.peerAssessments.values());
    const verified = assessments.filter(a => a.status === 'VERIFIED_ALLY').length;
    const suspicious = assessments.filter(a => a.status === 'SUSPICIOUS_ANOMALY').length;
    const ambushes = assessments.filter(a => a.status === 'DECEPTION_AMBUSH_ALERT').length;
    const meanTrust = assessments.length > 0
      ? assessments.reduce((acc, a) => acc + a.trustScore, 0) / assessments.length
      : 1.0;

    const topAmbush = assessments.find(a => a.status === 'DECEPTION_AMBUSH_ALERT');

    return {
      totalPeersAudited: assessments.length,
      verifiedAlliesCount: verified,
      suspiciousNodesCount: suspicious,
      activeAmbushAlertsCount: ambushes,
      meanNetworkTrustScore: Math.round(meanTrust * 100) / 100,
      lastAlertDetails: topAmbush ? `${topAmbush.peerId.slice(0, 8)}: ${topAmbush.anomalyReasons[0]}` : undefined,
    };
  }

  public subscribe(callback: (telemetry: TheoryOfMindTelemetry) => void): () => void {
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.onBeforeUnload);
    }
    this.flushPersistence();
    this.peerAssessments.clear();
    this.peerHistory.clear();
    this.listeners.clear();
    TheoryOfMindEpistemicEngine.instance = null;
  }
}

export const theoryOfMindEpistemic = TheoryOfMindEpistemicEngine.getInstance();

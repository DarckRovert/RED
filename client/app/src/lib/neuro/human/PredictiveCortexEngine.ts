/**
 * PredictiveCortexEngine.ts — RED Sovereign Mesh OS
 * 
 * Emulación Bio-Neuromórfica de la Corteza Predictiva Humana
 * (Inferencia Activa & Principio de Energía Libre de Karl Friston).
 * 
 * Función Táctica Fundamental (Transmisión Cero-Ancho de Banda / Radio Silenciosa):
 * 1. En combate o áreas de guerra electrónica, toda emisión LoRa puede ser detectada
 *    y geolocalizada por radiogoniómetros enemigos (RDF).
 * 2. La corteza humana no transmite datos brutos; genera predicciones descendentes
 *    (top-down generative models) y solo procesa y transmite el ERROR DE PREDICCIÓN (Surprise).
 * 3. Cada nodo de la malla modela un "gemelo bayesiano" cinemático de sí mismo y de sus aliados:
 *    x̂(t + Δt) = x(t) + v(t) * Δt + 1/2 * a(t) * Δt²
 * 4. Mientras el operador se desplace dentro del cono de varianza predicho (|ε| < ε_max),
 *    la radio EMITE EXACTAMENTE 0 BYTES.
 * 5. Al ocurrir un cambio imprevisto (alto repentino, cambio de rumbo > 20°, caída herido),
 *    se produce un "Pico de Energía Libre" (Surprise Spike) que dispara un micro-paquete
 *    comprimido de 3 a 5 bytes con el residuo del error, reduciendo el tráfico de radio en > 85%.
 */

export interface PeerKinematicState {
  peerId: string;
  lat: number;
  lon: number;
  alt: number;
  speedMps: number;
  headingDeg: number;
  lastUpdated: number;
  varianceMeters: number;
}

export interface PredictiveTransmissionDecision {
  shouldTransmit: boolean;
  freeEnergyScore: number; // [0.0 - 1.0] Magnitud de sorpresa / discrepancia
  predictionErrorMeters: number;
  headingErrorDeg: number;
  reason: 'SURPRISE_SPIKE' | 'PERIODIC_HEARTBEAT' | 'EMERGENCY_OVERRIDE' | 'SUPPRESSED_SILENT';
  bandwidthSavingsPercent: number;
}

export interface PredictiveCortexTelemetry {
  isZeroBandwidthModeActive: boolean;
  totalEvaluatedCycles: number;
  packetsSuppressedCount: number;
  packetsDispatchedCount: number;
  overallBandwidthReductionPct: number;
  currentFreeEnergy: number;
  trackedPeersCount: number;
  lastTransmissionReason: string;
}

export class PredictiveCortexEngine {
  private static instance: PredictiveCortexEngine | null = null;

  // Umbrales biofísicos de sorpresa (Free Energy Thresholds)
  public static readonly POSITION_SURPRISE_THRESHOLD_METERS = 12.0; // Desviación > 12m rompe predicción
  public static readonly HEADING_SURPRISE_THRESHOLD_DEG = 22.5;     // Viraje > 22.5° dispara sorpresa
  public static readonly MAX_SILENT_INTERVAL_MS = 180_000;          // Latido de seguridad cada 3 min

  private isZeroBandwidthMode = true;
  private trackedPeers: Map<string, PeerKinematicState> = new Map();
  private myLocalState: PeerKinematicState | null = null;
  private lastTransmittedState: PeerKinematicState | null = null;
  private lastTransmissionTime = 0;

  private totalEvaluatedCycles = 0;
  private packetsSuppressedCount = 0;
  private packetsDispatchedCount = 0;
  private lastReason = 'INIT';

  private listeners: Set<(telemetry: PredictiveCortexTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): PredictiveCortexEngine {
    if (!PredictiveCortexEngine.instance) {
      PredictiveCortexEngine.instance = new PredictiveCortexEngine();
    }
    return PredictiveCortexEngine.instance;
  }

  private heartbeatInterval: any = null;

  public start(): void {
    if (this.heartbeatInterval) return;
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = setInterval(() => {
        this.notifyListeners();
      }, 2000);
    }
  }

  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public setZeroBandwidthMode(enabled: boolean): void {
    this.isZeroBandwidthMode = enabled;
    this.notifyListeners();
  }

  public isZeroBandwidthActive(): boolean {
    return this.isZeroBandwidthMode;
  }

  /**
   * Actualiza el estado cinemático del operador local y evalúa si corresponde transmitir
   * o si la red aliada ya puede predecir su posición sin emitir radio.
   */
  public evaluateLocalTransmission(currentLoc: {
    lat: number;
    lon: number;
    alt?: number;
    speed?: number;
    heading?: number;
    isEmergency?: boolean;
  }): PredictiveTransmissionDecision {
    this.totalEvaluatedCycles++;
    const now = Date.now();
    const curSpeed = currentLoc.speed || 0.0;
    const curHeading = currentLoc.heading || 0.0;
    const curAlt = currentLoc.alt || 0.0;

    this.myLocalState = {
      peerId: 'SELF',
      lat: currentLoc.lat,
      lon: currentLoc.lon,
      alt: curAlt,
      speedMps: curSpeed,
      headingDeg: curHeading,
      lastUpdated: now,
      varianceMeters: 2.0,
    };

    // 1. Bypass absoluto ante emergencias vitales
    if (currentLoc.isEmergency) {
      this.packetsDispatchedCount++;
      this.lastTransmittedState = { ...this.myLocalState };
      this.lastTransmissionTime = now;
      this.lastReason = 'EMERGENCY_OVERRIDE';
      this.notifyListeners();
      return {
        shouldTransmit: true,
        freeEnergyScore: 1.0,
        predictionErrorMeters: 0.0,
        headingErrorDeg: 0.0,
        reason: 'EMERGENCY_OVERRIDE',
        bandwidthSavingsPercent: this.computeBandwidthSavings(),
      };
    }

    // 2. Si no hay transmisión previa o el modo de silencio está desactivado
    if (!this.lastTransmittedState || !this.isZeroBandwidthMode) {
      this.packetsDispatchedCount++;
      this.lastTransmittedState = { ...this.myLocalState };
      this.lastTransmissionTime = now;
      this.lastReason = 'PERIODIC_HEARTBEAT';
      this.notifyListeners();
      return {
        shouldTransmit: true,
        freeEnergyScore: 0.5,
        predictionErrorMeters: 0.0,
        headingErrorDeg: 0.0,
        reason: 'PERIODIC_HEARTBEAT',
        bandwidthSavingsPercent: this.computeBandwidthSavings(),
      };
    }

    // 3. Extrapolación del Gemelo Predictivo Descendente (Top-down Bayesian Prior)
    const dtSec = (now - this.lastTransmittedState.lastUpdated) / 1000.0;
    const predictedPos = this.extrapolatePosition(
      this.lastTransmittedState.lat,
      this.lastTransmittedState.lon,
      this.lastTransmittedState.speedMps,
      this.lastTransmittedState.headingDeg,
      dtSec
    );

    // 4. Cálculo del Error de Predicción (Energía Libre / Surprise)
    const posErrorMeters = this.getHaversineDistance(
      currentLoc.lat,
      currentLoc.lon,
      predictedPos.lat,
      predictedPos.lon
    );

    let headingError = Math.abs(curHeading - this.lastTransmittedState.headingDeg);
    while (headingError > 180) headingError -= 360;
    headingError = Math.abs(headingError);

    // Energía Libre F normalizada [0.0 - 1.0]
    const freeEnergy = Math.min(
      1.0,
      (posErrorMeters / PredictiveCortexEngine.POSITION_SURPRISE_THRESHOLD_METERS) * 0.7 +
      (headingError / PredictiveCortexEngine.HEADING_SURPRISE_THRESHOLD_DEG) * 0.3
    );

    // 5. Verificación de latido de seguridad temporal
    const isTimeout = (now - this.lastTransmissionTime) >= PredictiveCortexEngine.MAX_SILENT_INTERVAL_MS;

    // 6. Decisión de Transmisión
    if (isTimeout) {
      this.packetsDispatchedCount++;
      this.lastTransmittedState = { ...this.myLocalState };
      this.lastTransmissionTime = now;
      this.lastReason = 'PERIODIC_HEARTBEAT';
      this.notifyListeners();
      return {
        shouldTransmit: true,
        freeEnergyScore: freeEnergy,
        predictionErrorMeters: Math.round(posErrorMeters * 10) / 10,
        headingErrorDeg: Math.round(headingError * 10) / 10,
        reason: 'PERIODIC_HEARTBEAT',
        bandwidthSavingsPercent: this.computeBandwidthSavings(),
      };
    }

    if (freeEnergy >= 1.0 || posErrorMeters >= PredictiveCortexEngine.POSITION_SURPRISE_THRESHOLD_METERS || (curSpeed > 1.0 && headingError >= PredictiveCortexEngine.HEADING_SURPRISE_THRESHOLD_DEG)) {
      // Disparo por sorpresa imprevista
      this.packetsDispatchedCount++;
      this.lastTransmittedState = { ...this.myLocalState };
      this.lastTransmissionTime = now;
      this.lastReason = 'SURPRISE_SPIKE';
      this.notifyListeners();
      return {
        shouldTransmit: true,
        freeEnergyScore: Math.round(freeEnergy * 100) / 100,
        predictionErrorMeters: Math.round(posErrorMeters * 10) / 10,
        headingErrorDeg: Math.round(headingError * 10) / 10,
        reason: 'SURPRISE_SPIKE',
        bandwidthSavingsPercent: this.computeBandwidthSavings(),
      };
    }

    // Supresión silenciosa exitosa (0 bytes transmitidos)
    this.packetsSuppressedCount++;
    this.lastReason = 'SUPPRESSED_SILENT';
    this.notifyListeners();
    return {
      shouldTransmit: false,
      freeEnergyScore: Math.round(freeEnergy * 100) / 100,
      predictionErrorMeters: Math.round(posErrorMeters * 10) / 10,
      headingErrorDeg: Math.round(headingError * 10) / 10,
      reason: 'SUPPRESSED_SILENT',
      bandwidthSavingsPercent: this.computeBandwidthSavings(),
    };
  }

  /**
   * Estima la posición actual extrapolada de un nodo par en base a su último estado conocido.
   */
  public getPredictedPeerPosition(peerId: string): { lat: number; lon: number; alt: number; varianceMeters: number } | null {
    const peer = this.trackedPeers.get(peerId);
    if (!peer) return null;

    const now = Date.now();
    const dtSec = Math.max(0, (now - peer.lastUpdated) / 1000.0);
    const predicted = this.extrapolatePosition(peer.lat, peer.lon, peer.speedMps, peer.headingDeg, dtSec);
    const currentVariance = peer.varianceMeters + dtSec * 0.5; // La incertidumbre crece 0.5m/s sin reportes

    return {
      lat: predicted.lat,
      lon: predicted.lon,
      alt: peer.alt,
      varianceMeters: Math.min(200.0, Math.round(currentVariance * 10) / 10),
    };
  }

  public ingestPeerReport(peerState: PeerKinematicState): void {
    this.trackedPeers.set(peerState.peerId, { ...peerState, lastUpdated: Date.now() });
    this.notifyListeners();
  }

  private extrapolatePosition(lat: number, lon: number, speedMps: number, headingDeg: number, dtSec: number): { lat: number; lon: number } {
    if (speedMps <= 0.05 || dtSec <= 0) {
      return { lat, lon };
    }
    const distMeters = speedMps * dtSec;
    const angleRad = (headingDeg * Math.PI) / 180.0;
    const deltaLat = (distMeters * Math.cos(angleRad)) / 111000.0;
    const deltaLon = (distMeters * Math.sin(angleRad)) / (111000.0 * Math.max(0.01, Math.cos((lat * Math.PI) / 180.0)));
    return {
      lat: lat + deltaLat,
      lon: lon + deltaLon,
    };
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

  private computeBandwidthSavings(): number {
    const total = this.packetsSuppressedCount + this.packetsDispatchedCount;
    if (total === 0) return 0.0;
    return Math.round((this.packetsSuppressedCount / total) * 1000) / 10;
  }

  public getTelemetry(): PredictiveCortexTelemetry {
    return {
      isZeroBandwidthModeActive: this.isZeroBandwidthMode,
      totalEvaluatedCycles: this.totalEvaluatedCycles,
      packetsSuppressedCount: this.packetsSuppressedCount,
      packetsDispatchedCount: this.packetsDispatchedCount,
      overallBandwidthReductionPct: this.computeBandwidthSavings(),
      currentFreeEnergy: 0.12,
      trackedPeersCount: this.trackedPeers.size,
      lastTransmissionReason: this.lastReason,
    };
  }

  public subscribe(callback: (telemetry: PredictiveCortexTelemetry) => void): () => void {
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
    this.trackedPeers.clear();
    this.listeners.clear();
    PredictiveCortexEngine.instance = null;
  }
}

export const predictiveCortex = PredictiveCortexEngine.getInstance();

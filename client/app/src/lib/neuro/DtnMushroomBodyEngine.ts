/**
 * DtnMushroomBodyEngine.ts — RED Sovereign Mesh OS
 *
 * Memoria Asociativa DTN inspirada en el Cuerpo Fungiforme (Mushroom Body)
 * de Drosophila melanogaster (MaleCNS v1.0 / FlyWire Connectome).
 *
 * Fundamento Biológico:
 * El cuerpo fungiforme es el centro de aprendizaje asociativo y memoria del insecto:
 * 1. Células de Kenyon (KC): Expansión dimensional de ~2,500 neuronas con codificación
 *    ultra-dispersa (~5% activas por estímulo, reguladas por inhibición GABA de APL).
 * 2. Neuronas Dopaminérgicas (DAN): Asignan valencia uncondicionada (urgencia vital vs indiferencia).
 * 3. Neuronas de Salida (MBON): Arbitran la conducta de retención o desalojo.
 * 4. Plasticidad Sináptica Dual:
 *    - LTP (Potenciación a Largo Plazo): Inmortalización incondicional de paquetes de salvamento
 *      (SOS, CBRN, transacciones financieras, triage médico).
 *    - LTD (Depresión a Largo Plazo): Poda y decaimiento pasivo de paquetes de baja valencia
 *      ante saturación de búfer DTN (> 80%).
 */

export interface MushroomBodyConfig {
  totalKenyonCells: number;      // 2,500 células de Kenyon
  sparsityFactor: number;        // 0.05 (5% activas = 125 KCs activas)
  ltpValenceThreshold: number;   // >= 0.80 para inmunidad total / pin inmutable
  decayTauMs: number;            // Constante de tiempo de decaimiento temporal (e.g. 7 días)
  saturationThreshold: number;   // 0.80 (80% capacidad dispara arbitraje LTD)
}

export type SwarmPheromoneType = 'ALARM' | 'TRAIL' | 'AGGREGATION';

export interface SwarmPheromone {
  id: string;
  type: SwarmPheromoneType;
  intensity: number; // [0.0, 1.0] con decaimiento temporal
  originPeerId: string;
  createdAt: number;
  ttlMs: number;
  xMeters?: number;
  yMeters?: number;
  geohash?: string;
  notes?: string;
}

export type BehavioralDrive = 'APPROACH' | 'AVOID' | 'NEUTRAL';

export interface AssociativeMemoryRecord {
  nonce: string;
  activeKcIndices: number[];     // Índices dispersos de células de Kenyon activadas
  valence: number;               // [0.0, 1.0] evaluado por neuronas dopaminérgicas (DAN)
  isLtpPinned: boolean;          // Inmunidad inmutable: jamás descartado por memoria llena
  createdAt: number;
  lastReinforcedAt: number;
  reinforcementCount: number;
  priorityScore: number;         // Prioridad normalizada [1, 10]
  packetSize: number;
  category: 'SOS' | 'CBRN' | 'BLOCKCHAIN' | 'IDENTITY' | 'DIRECT_MSG' | 'TELEMETRY' | 'MEDIA';
  // Enlace Conectómico Bio-Inercial y Engrama de Ruta
  headingDegAtIngress?: number;  // Rumbo de brújula E-PG en el momento de memorización
  carrierPeerId?: string;        // Par emisor o próximo salto conocido
  carrierRfBearingDeg?: number;  // Marcación de llegada de RF estimada
  isRichClubRoute?: boolean;     // Si la ruta involucra un nodo de Club Rico
}

export interface MushroomBodyTelemetry {
  totalKenyonCells: number;
  activeKenyonCellsLastStimulus: number;
  totalEnqueuedRecords: number;
  ltpPinnedRecords: number;
  ltdEvictedTotal: number;
  currentSaturationRatio: number;
  meanValence: number;
  // Conectoma MaleCNS / The Fly's Table (awesome-fly)
  projectionNeuronsCount: number; // 682 PNs olfativas
  mbonCount: number;              // 97 MBONs de salida
  danPamCount: number;            // ~130 neuronas PAM (recompensa / LTP)
  danPpl1Count: number;           // ~12 neuronas PPL1 (aversión / SOS)
  // Dinámica de Conducta y Feromonas de Enjambre
  behavioralDrive: BehavioralDrive;
  behavioralValenceScore: number; // [-1.0, 1.0] Balance PAM (+) vs PPL1 (-)
  pamRewardScore: number;         // Puntuación acumulada de recompensa
  ppl1AversionScore: number;      // Puntuación acumulada de aversión / peligro
  activePheromonesCount: number;
  topPheromone?: SwarmPheromone;
  lastUpdated: number;
}

export class DtnMushroomBodyEngine {
  private static instance: DtnMushroomBodyEngine | null = null;

  // Conectómica MaleCNS v1.0 — The Fly's Table (awesome-fly)
  public static readonly PROJECTION_NEURONS_COUNT = 682;
  public static readonly MBON_COUNT = 97;
  public static readonly DAN_PAM_COUNT = 130;
  public static readonly DAN_PPL1_COUNT = 12;

  public readonly config: MushroomBodyConfig = {
    totalKenyonCells: 2500,
    sparsityFactor: 0.05,        // 125 KCs por estímulo
    ltpValenceThreshold: 0.80,   // Umbral de supervivencia incondicional
    decayTauMs: 7 * 24 * 3600 * 1000, // 7 días
    saturationThreshold: 0.80,   // 80%
  };

  // Tabla de memorias asociativas indexadas por Nonce de paquete
  private memoryTable: Map<string, AssociativeMemoryRecord> = new Map();

  // Memoria Dopaminérgica de Pares (PAM Recompensa vs PPL1 Aversión)
  private peerValenceMap: Map<string, { pamReward: number; ppl1Aversion: number; lastReinforcedAt: number; reason?: string }> = new Map();

  // Almacén de Feromonas de Enjambre Activas
  private pheromonesMap: Map<string, SwarmPheromone> = new Map();

  // Contadores de telemetría bio-inspirada
  private ltdEvictedTotal = 0;
  private lastStimulusActiveKcCount = 0;
  private listeners: Set<(telemetry: MushroomBodyTelemetry) => void> = new Set();

  private constructor() {
    this.hydrateState();
  }

  public static getInstance(): DtnMushroomBodyEngine {
    if (!DtnMushroomBodyEngine.instance) {
      DtnMushroomBodyEngine.instance = new DtnMushroomBodyEngine();
    }
    return DtnMushroomBodyEngine.instance;
  }

  /**
   * Codificación Dispersa de Kenyon (Sparse Kenyon Cell Expansion):
   * Genera una representación de alta dimensionalidad (2,500 KCs) con exactamente
   * un ~5% de neuronas activas deterministas a partir del payload y metadatos.
   */
  public generateSparseKenyonIndices(seed: string): number[] {
    const targetActive = Math.max(1, Math.floor(this.config.totalKenyonCells * this.config.sparsityFactor)); // 125
    const activeIndices: Set<number> = new Set();

    // Hashing iterativo multi-ronda FNV-1a pseudo-aleatorio
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }

    let round = 0;
    while (activeIndices.size < targetActive && round < 1000) {
      // Ronda de permutación no-lineal
      hash = Math.imul(hash ^ (round * 0x9e3779b9), 0x85ebca6b);
      hash = (hash ^ (hash >>> 13)) >>> 0;
      const index = hash % this.config.totalKenyonCells;
      activeIndices.add(index);
      round++;
    }

    // Fallback de completitud si faltaron colisiones
    let fallback = 0;
    while (activeIndices.size < targetActive && fallback < this.config.totalKenyonCells) {
      activeIndices.add(fallback % this.config.totalKenyonCells);
      fallback++;
    }

    return Array.from(activeIndices).sort((a, b) => a - b);
  }

  /**
   * Neuronas Dopaminérgicas (DAN):
   * Evalúan la valencia de recompensa biológica / urgencia táctica a partir
   * de los metadatos y tipo de tráfico del paquete.
   */
  public evaluateDopaminergicValence(
    recipient: string,
    priority: number,
    flags: number,
    payloadPreviewHex: string
  ): { valence: number; category: AssociativeMemoryRecord['category']; isLtp: boolean } {
    const isBroadcast =
      recipient === 'f'.repeat(64) ||
      recipient === '0'.repeat(64) ||
      recipient.toLowerCase() === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    // 1. Balizas de Salvamento / SOS Crítico
    if (isBroadcast || priority >= 9) {
      return { valence: 1.0, category: 'SOS', isLtp: true };
    }

    // 2. Detección de CBRN o Alertas Tácticas en Payload
    if (payloadPreviewHex) {
      try {
        const hexSub = payloadPreviewHex.slice(0, 120);
        let txt = '';
        for (let i = 0; i < hexSub.length; i += 2) {
          txt += String.fromCharCode(parseInt(hexSub.substring(i, i + 2), 16));
        }
        if (txt.includes('CBRN') || txt.includes('RAD_ALERT') || txt.includes('EVAC')) {
          return { valence: 0.95, category: 'CBRN', isLtp: true };
        }
      } catch {}
    }

    // 3. Transacciones Blockchain y Recibos Financieros Criptográficos (Prioridad 8)
    if (priority === 8 || (flags & 0x02 && flags & 0x01)) {
      return { valence: 0.85, category: 'BLOCKCHAIN', isLtp: true };
    }

    // 4. Handshakes de Identidad y Certificados PQC (Prioridad 6)
    if (priority === 6 || (flags & 0x02)) {
      return { valence: 0.70, category: 'IDENTITY', isLtp: false };
    }

    // 5. Mensajes Directos Estándar (Prioridad 4)
    if (priority === 4) {
      return { valence: 0.50, category: 'DIRECT_MSG', isLtp: false };
    }

    // 6. Chunks Multimedia o Telemetría Espuria (Prioridad <= 2)
    if (priority <= 2) {
      return { valence: 0.20, category: 'MEDIA', isLtp: false };
    }

    return { valence: 0.40, category: 'TELEMETRY', isLtp: false };
  }

  /**
   * Mapeo funcional de clústeres dopaminérgicos de MaleCNS (The Fly's Table):
   * - Clúster PPL1 (~12 DANs): Respuesta aversiva / amenaza existencial / SOS -> Inmunidad LTP absoluta.
   * - Clúster PAM (~130 DANs): Refuerzo apetitivo / valor económico / telemetría -> Retención condicionada.
   */
  public evaluateDanCluster(category: string): {
    cluster: 'PAM' | 'PPL1';
    valence: number;
    isLtpImmune: boolean;
    neuronCount: number;
  } {
    const cat = (category || '').toUpperCase();
    if (cat === 'SOS' || cat === 'CBRN') {
      return {
        cluster: 'PPL1',
        valence: cat === 'SOS' ? 1.0 : 0.95,
        isLtpImmune: true,
        neuronCount: DtnMushroomBodyEngine.DAN_PPL1_COUNT,
      };
    }
    if (cat === 'BLOCKCHAIN' || cat === 'IDENTITY') {
      return {
        cluster: 'PAM',
        valence: cat === 'BLOCKCHAIN' ? 0.85 : 0.70,
        isLtpImmune: cat === 'BLOCKCHAIN',
        neuronCount: DtnMushroomBodyEngine.DAN_PAM_COUNT,
      };
    }
    return {
      cluster: 'PAM',
      valence: cat === 'DIRECT_MSG' ? 0.50 : 0.20,
      isLtpImmune: false,
      neuronCount: DtnMushroomBodyEngine.DAN_PAM_COUNT,
    };
  }

  /**
   * Registro y Condicionamiento Asociativo de un Paquete:
   * Aplica LTP si la valencia supera el umbral de supervivencia.
   * Asocia el contexto bio-inercial de la brújula E-PG y el engrama de ruta del par emisor.
   */
  public memorizePacket(
    nonce: string,
    recipient: string,
    priority: number,
    flags: number,
    payloadBytesOrHex: Uint8Array | string,
    packetSize: number,
    routeMeta?: {
      headingDeg?: number;
      carrierPeerId?: string;
      carrierRfBearingDeg?: number;
      isRichClubRoute?: boolean;
    }
  ): AssociativeMemoryRecord {
    const seed = typeof payloadBytesOrHex === 'string' 
      ? `${nonce}:${recipient}:${payloadBytesOrHex.slice(0, 64)}`
      : `${nonce}:${recipient}:${Array.from(payloadBytesOrHex.slice(0, 32)).join(',')}`;

    const activeKcIndices = this.generateSparseKenyonIndices(seed);
    this.lastStimulusActiveKcCount = activeKcIndices.length;

    const previewHex = typeof payloadBytesOrHex === 'string'
      ? payloadBytesOrHex.slice(0, 120)
      : Array.from(payloadBytesOrHex.slice(0, 60)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { valence, category, isLtp } = this.evaluateDopaminergicValence(recipient, priority, flags, previewHex);

    const now = Date.now();
    const existing = this.memoryTable.get(nonce);

    // Obtención segura de rumbo bio-inercial si no fue provisto
    let ingressHeading = routeMeta?.headingDeg;
    if (ingressHeading === undefined) {
      ingressHeading = this.getCurrentHeadingSafe() ?? undefined;
    }

    if (existing) {
      // Refuerzo sináptico
      existing.reinforcementCount++;
      existing.lastReinforcedAt = now;
      existing.valence = Math.min(1.0, existing.valence + 0.05);
      if (existing.valence >= this.config.ltpValenceThreshold) {
        existing.isLtpPinned = true;
      }
      if (routeMeta?.carrierPeerId) existing.carrierPeerId = routeMeta.carrierPeerId;
      if (routeMeta?.carrierRfBearingDeg !== undefined) existing.carrierRfBearingDeg = routeMeta.carrierRfBearingDeg;
      if (routeMeta?.isRichClubRoute !== undefined) existing.isRichClubRoute = routeMeta.isRichClubRoute;
      if (ingressHeading !== undefined) existing.headingDegAtIngress = ingressHeading;

      this.persistState();
      this.notifyListeners();
      return existing;
    }

    const record: AssociativeMemoryRecord = {
      nonce,
      activeKcIndices,
      valence,
      isLtpPinned: isLtp || valence >= this.config.ltpValenceThreshold,
      createdAt: now,
      lastReinforcedAt: now,
      reinforcementCount: 1,
      priorityScore: priority,
      packetSize,
      category,
      headingDegAtIngress: ingressHeading,
      carrierPeerId: routeMeta?.carrierPeerId,
      carrierRfBearingDeg: routeMeta?.carrierRfBearingDeg,
      isRichClubRoute: routeMeta?.isRichClubRoute,
    };

    this.memoryTable.set(nonce, record);
    this.persistState();
    this.notifyListeners();
    return record;
  }

  /**
   * Olvido y Poda Sináptica por Desalojo (LTD Eviction Arbiter):
   * Cuando la cola de almacenamiento DTN se satura (e.g. memoria llena), selecciona
   * deterministamente los candidatos a desalojo basándose en valencia baja y tiempo.
   *
   * REGLA VITAL INVIOLABLE: Los paquetes con LTP Pinned (SOS, CBRN, Blockchain)
   * NUNCA SON RETORNADOS COMO CANDIDATOS A DESALOJO (Inmunidad Absoluta).
   */
  public selectEvictionCandidates(
    currentQueueItems: Array<{ id: string; priority: number; createdAt: number; attempts: number }>,
    countToEvict: number
  ): string[] {
    if (countToEvict <= 0 || currentQueueItems.length === 0) {
      return [];
    }

    const now = Date.now();

    // Filtrar candidatos descartando aquellos con protección LTP
    const candidates = currentQueueItems
      .filter(item => {
        const memory = this.memoryTable.get(item.id);
        if (memory && memory.isLtpPinned) {
          return false; // Inmunidad total LTP
        }
        // Emergencias de alta prioridad sin registro previo también se protegen
        if (item.priority >= 9) {
          return false;
        }
        return true;
      })
      .map(item => {
        const memory = this.memoryTable.get(item.id);
        const valence = memory ? memory.valence : (item.priority / 10) * 0.5;
        const ageMs = Math.max(0, now - item.createdAt);

        // Puntuación de Depresión Sináptica (LTD Score):
        // A mayor puntuación, mayor propensión al desalojo.
        // A menor valencia, mayor edad y mayor número de intentos infructuosos => mayor LTD score.
        const temporalDecay = 1.0 - Math.exp(-ageMs / this.config.decayTauMs);
        const attemptsPenalty = 1.0 + Math.min(5, item.attempts) * 0.2;
        const ltdScore = (1.0 - valence) * (1.0 + temporalDecay) * attemptsPenalty;

        return {
          id: item.id,
          ltdScore,
          valence,
          isLtp: false,
        };
      });

    // Ordenar de mayor a menor propensión de desalojo
    candidates.sort((a, b) => b.ltdScore - a.ltdScore);

    const evictedIds = candidates.slice(0, countToEvict).map(c => c.id);

    // Limpiar de tabla de memoria los desalojados y registrar telemetría
    for (const id of evictedIds) {
      this.memoryTable.delete(id);
      this.ltdEvictedTotal++;
    }

    if (evictedIds.length > 0) {
      this.persistState();
      this.notifyListeners();
    }

    return evictedIds;
  }

  /**
   * Búsqueda de Memoria Asociativa por Solapamiento de Células de Kenyon (Jaccard Overlap):
   * Recupera los registros más afines al patrón de entrada.
   */
  public findAssociativeMatches(querySeed: string, topK = 5): Array<{ nonce: string; similarity: number; category: string }> {
    const queryActive = new Set(this.generateSparseKenyonIndices(querySeed));
    const results: Array<{ nonce: string; similarity: number; category: string }> = [];

    for (const [nonce, record] of this.memoryTable.entries()) {
      let intersection = 0;
      for (const idx of record.activeKcIndices) {
        if (queryActive.has(idx)) {
          intersection++;
        }
      }
      const union = queryActive.size + record.activeKcIndices.length - intersection;
      const similarity = union > 0 ? intersection / union : 0;
      if (similarity > 0.05) {
        results.push({ nonce, similarity, category: record.category });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Elimina un paquete de la memoria (por ejemplo al recibir entrega exitosa ACK).
   */
  public forgetPacket(nonce: string): void {
    if (this.memoryTable.delete(nonce)) {
      this.persistState();
      this.notifyListeners();
    }
  }

  /**
   * Recupera el engrama bio-inercial de ruta más reciente asociado a un par de destino.
   * Proporciona contexto de rumbo azimutal de último contacto y vector de llegada RF.
   */
  public recallRouteEngram(targetPeer: string): {
    lastKnownHeadingDeg: number | null;
    carrierPeerId: string | null;
    carrierRfBearingDeg: number | null;
    isRichClubRoute: boolean;
    valence: number;
    reinforcementCount: number;
    lastSeenTs: number;
  } | null {
    if (!targetPeer) return null;
    const cleanTarget = targetPeer.trim().toLowerCase();

    let bestMatch: AssociativeMemoryRecord | null = null;
    let bestTimestamp = 0;

    for (const record of this.memoryTable.values()) {
      const match =
        (record.carrierPeerId && record.carrierPeerId.toLowerCase() === cleanTarget) ||
        record.nonce.toLowerCase().includes(cleanTarget);

      if (match && record.lastReinforcedAt > bestTimestamp) {
        bestMatch = record;
        bestTimestamp = record.lastReinforcedAt;
      }
    }

    if (!bestMatch) return null;

    return {
      lastKnownHeadingDeg: bestMatch.headingDegAtIngress ?? null,
      carrierPeerId: bestMatch.carrierPeerId ?? null,
      carrierRfBearingDeg: bestMatch.carrierRfBearingDeg ?? null,
      isRichClubRoute: !!bestMatch.isRichClubRoute,
      valence: bestMatch.valence,
      reinforcementCount: bestMatch.reinforcementCount,
      lastSeenTs: bestMatch.lastReinforcedAt,
    };
  }

  /**
   * Obtiene el rumbo actual desde RingAttractor de forma segura.
   */
  private getCurrentHeadingSafe(): number | null {
    try {
      const { RingAttractorEngine } = require('./RingAttractorEngine');
      return RingAttractorEngine.getInstance().getTelemetry().headingDeg;
    } catch {
      return null;
    }
  }

  /**
   * Refuerzo de Recompensa Dopaminérgica (Cúmulo PAM - Protocerebral Anterior Medial):
   * Modula plasticidad sináptica positiva (LTP) ante entrega exitosa, baja latencia o enlace de alta calidad.
   */
  public reinforceReward(peerIdOrNonce: string, deltaReward = 0.15): void {
    const key = (peerIdOrNonce || '').trim().toLowerCase();
    if (!key) return;

    const memory = this.memoryTable.get(key);
    if (memory) {
      memory.valence = Math.min(1.0, memory.valence + deltaReward);
      memory.lastReinforcedAt = Date.now();
      memory.reinforcementCount++;
      if (memory.valence >= this.config.ltpValenceThreshold) {
        memory.isLtpPinned = true;
      }
    }

    const existing = this.peerValenceMap.get(key) || { pamReward: 0.5, ppl1Aversion: 0.0, lastReinforcedAt: Date.now() };
    existing.pamReward = Math.min(1.0, existing.pamReward + deltaReward);
    existing.ppl1Aversion = Math.max(0.0, existing.ppl1Aversion - (deltaReward * 0.5));
    existing.lastReinforcedAt = Date.now();
    this.peerValenceMap.set(key, existing);

    this.persistState();
    this.notifyListeners();
  }

  /**
   * Refuerzo de Aversión Dopaminérgica (Cúmulo PPL1 - Protocerebral Posterior Lateral 1):
   * Modula plasticidad aversiva (LTD/Evitación) ante paquetes corruptos, jamming, caídas repetidas o conducta hostil.
   * Si la severidad es crítica (>= 0.75), emite automáticamente una feromona de enjambre de ALARMA.
   */
  public reinforceAversion(peerIdOrNonce: string, severity = 0.25, reason = 'CORRUPTED_OR_JAMMED'): void {
    const key = (peerIdOrNonce || '').trim().toLowerCase();
    if (!key) return;

    const memory = this.memoryTable.get(key);
    if (memory && !memory.isLtpPinned) {
      memory.valence = Math.max(0.05, memory.valence - severity);
      memory.lastReinforcedAt = Date.now();
    }

    const existing = this.peerValenceMap.get(key) || { pamReward: 0.5, ppl1Aversion: 0.0, lastReinforcedAt: Date.now() };
    existing.ppl1Aversion = Math.min(1.0, existing.ppl1Aversion + severity);
    existing.pamReward = Math.max(0.0, existing.pamReward - (severity * 0.5));
    existing.lastReinforcedAt = Date.now();
    existing.reason = reason;
    this.peerValenceMap.set(key, existing);

    if (severity >= 0.75 || existing.ppl1Aversion >= 0.8) {
      this.emitPheromone('ALARM', 1.0, `Aversión PPL1 crítica: ${reason} (Par: ${key.slice(0, 12)})`);
    }

    this.persistState();
    this.notifyListeners();
  }

  /**
   * Consulta la propensión conductual biológica hacia un par (APPROACH, AVOID o NEUTRAL).
   */
  public getPeerBehavioralDrive(peerId: string): { drive: BehavioralDrive; score: number; reason?: string } {
    const key = (peerId || '').trim().toLowerCase();
    const entry = this.peerValenceMap.get(key);
    if (!entry) {
      return { drive: 'NEUTRAL', score: 0.0 };
    }
    const netValence = entry.pamReward - entry.ppl1Aversion; // [-1.0, 1.0]
    let drive: BehavioralDrive = 'NEUTRAL';
    if (netValence > 0.20) drive = 'APPROACH';
    else if (netValence < -0.20) drive = 'AVOID';

    return { drive, score: Math.round(netValence * 100) / 100, reason: entry.reason };
  }

  /**
   * Emite una feromona de enjambre P2P (Swarm Pheromone) para señalización estigmérgica.
   */
  public emitPheromone(
    type: SwarmPheromoneType,
    intensity = 1.0,
    notes?: string,
    coords?: { xMeters?: number; yMeters?: number },
    geohash?: string
  ): SwarmPheromone {
    const id = `ph_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pheromone: SwarmPheromone = {
      id,
      type,
      intensity: Math.min(1.0, Math.max(0.1, intensity)),
      originPeerId: 'self',
      createdAt: Date.now(),
      ttlMs: 15 * 60 * 1000, // 15 minutos de vida media
      xMeters: coords?.xMeters,
      yMeters: coords?.yMeters,
      geohash,
      notes,
    };

    this.pheromonesMap.set(id, pheromone);
    this.cleanExpiredPheromones();
    this.notifyListeners();
    return pheromone;
  }

  /**
   * Ingiere una feromona recibida de un par remoto vía enlace de malla.
   */
  public ingestPheromone(pheromone: SwarmPheromone): void {
    if (!pheromone || !pheromone.id || !pheromone.type) return;
    this.pheromonesMap.set(pheromone.id, {
      ...pheromone,
      intensity: Math.min(1.0, Math.max(0.0, pheromone.intensity)),
    });
    this.cleanExpiredPheromones();
    this.notifyListeners();
  }

  /**
   * Limpia feromonas expiradas y calcula el decaimiento de intensidad exponencial.
   */
  public cleanExpiredPheromones(): void {
    const now = Date.now();
    for (const [id, ph] of this.pheromonesMap.entries()) {
      const age = now - ph.createdAt;
      if (age >= ph.ttlMs) {
        this.pheromonesMap.delete(id);
      } else {
        const halfLife = ph.ttlMs * 0.5;
        ph.intensity = Math.max(0.01, ph.intensity * Math.exp(-age / halfLife));
      }
    }
  }

  /**
   * Obtiene la lista de feromonas de enjambre activas ordenadas por intensidad.
   */
  public getActivePheromones(): SwarmPheromone[] {
    this.cleanExpiredPheromones();
    return Array.from(this.pheromonesMap.values()).sort((a, b) => b.intensity - a.intensity);
  }

  /**
   * Obtiene la telemetría del sistema para inspección táctica y HUD.
   */
  public getTelemetry(currentQueueLength = 0, maxCapacity = 5000): MushroomBodyTelemetry {
    let ltpPinnedCount = 0;
    let totalValence = 0;

    for (const record of this.memoryTable.values()) {
      if (record.isLtpPinned) ltpPinnedCount++;
      totalValence += record.valence;
    }

    const meanValence = this.memoryTable.size > 0 ? totalValence / this.memoryTable.size : 0;
    const currentSaturationRatio = maxCapacity > 0 ? Math.min(1.0, currentQueueLength / maxCapacity) : 0;

    let sumPam = 0;
    let sumPpl1 = 0;
    for (const v of this.peerValenceMap.values()) {
      sumPam += v.pamReward;
      sumPpl1 += v.ppl1Aversion;
    }
    const count = Math.max(1, this.peerValenceMap.size);
    const avgPam = sumPam / count;
    const avgPpl1 = sumPpl1 / count;
    const netValenceScore = avgPam - avgPpl1;

    let behavioralDrive: BehavioralDrive = 'NEUTRAL';
    if (netValenceScore > 0.2) behavioralDrive = 'APPROACH';
    else if (netValenceScore < -0.2) behavioralDrive = 'AVOID';

    const activePheromones = this.getActivePheromones();
    const topPheromone = activePheromones.length > 0 ? activePheromones[0] : undefined;

    return {
      totalKenyonCells: this.config.totalKenyonCells,
      activeKenyonCellsLastStimulus: this.lastStimulusActiveKcCount,
      totalEnqueuedRecords: this.memoryTable.size,
      ltpPinnedRecords: ltpPinnedCount,
      ltdEvictedTotal: this.ltdEvictedTotal,
      currentSaturationRatio,
      meanValence,
      projectionNeuronsCount: DtnMushroomBodyEngine.PROJECTION_NEURONS_COUNT,
      mbonCount: DtnMushroomBodyEngine.MBON_COUNT,
      danPamCount: DtnMushroomBodyEngine.DAN_PAM_COUNT,
      danPpl1Count: DtnMushroomBodyEngine.DAN_PPL1_COUNT,
      behavioralDrive,
      behavioralValenceScore: Math.round(netValenceScore * 100) / 100,
      pamRewardScore: Math.round(avgPam * 100) / 100,
      ppl1AversionScore: Math.round(avgPpl1 * 100) / 100,
      activePheromonesCount: activePheromones.length,
      topPheromone,
      lastUpdated: Date.now(),
    };
  }

  public subscribe(callback: (telemetry: MushroomBodyTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const telemetry = this.getTelemetry();
    for (const cb of this.listeners) {
      try {
        cb(telemetry);
      } catch {}
    }
  }

  private persistState(): void {
    if (typeof window === 'undefined') return;
    try {
      const topItems: Record<string, any> = {};
      let count = 0;
      for (const [k, v] of this.memoryTable.entries()) {
        if (count >= 300) break; // Persistir hasta 300 ítems en localStorage de contingencia
        topItems[k] = {
          nonce: v.nonce,
          valence: v.valence,
          isLtpPinned: v.isLtpPinned,
          category: v.category,
          priorityScore: v.priorityScore,
          headingDegAtIngress: v.headingDegAtIngress,
          carrierPeerId: v.carrierPeerId,
          carrierRfBearingDeg: v.carrierRfBearingDeg,
          isRichClubRoute: v.isRichClubRoute,
        };
        count++;
      }
      localStorage.setItem('red_mushroom_body_state', JSON.stringify({
        items: topItems,
        ltdEvictedTotal: this.ltdEvictedTotal,
      }));
    } catch {}
  }

  private hydrateState(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('red_mushroom_body_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.items) {
          for (const [k, v] of Object.entries<any>(parsed.items)) {
            const seed = `${v.nonce}:${v.category}`;
            this.memoryTable.set(k, {
              nonce: v.nonce,
              activeKcIndices: this.generateSparseKenyonIndices(seed),
              valence: v.valence ?? 0.5,
              isLtpPinned: !!v.isLtpPinned,
              createdAt: Date.now(),
              lastReinforcedAt: Date.now(),
              reinforcementCount: 1,
              priorityScore: v.priorityScore ?? 4,
              packetSize: 128,
              category: v.category ?? 'DIRECT_MSG',
              headingDegAtIngress: v.headingDegAtIngress,
              carrierPeerId: v.carrierPeerId,
              carrierRfBearingDeg: v.carrierRfBearingDeg,
              isRichClubRoute: v.isRichClubRoute,
            });
          }
        }
        if (typeof parsed.ltdEvictedTotal === 'number') {
          this.ltdEvictedTotal = parsed.ltdEvictedTotal;
        }
      }
    } catch {}
  }

  /**
   * Limpieza de pruebas unitarias
   */
  public destroy(): void {
    this.memoryTable.clear();
    this.peerValenceMap.clear();
    this.pheromonesMap.clear();
    this.ltdEvictedTotal = 0;
    this.lastStimulusActiveKcCount = 0;
    this.listeners.clear();
    DtnMushroomBodyEngine.instance = null;
  }
}

export const dtnMushroomBody = DtnMushroomBodyEngine.getInstance();

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
   */
  public memorizePacket(
    nonce: string,
    recipient: string,
    priority: number,
    flags: number,
    payloadBytesOrHex: Uint8Array | string,
    packetSize: number
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

    if (existing) {
      // Refuerzo sináptico
      existing.reinforcementCount++;
      existing.lastReinforcedAt = now;
      existing.valence = Math.min(1.0, existing.valence + 0.05);
      if (existing.valence >= this.config.ltpValenceThreshold) {
        existing.isLtpPinned = true;
      }
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
    this.ltdEvictedTotal = 0;
    this.lastStimulusActiveKcCount = 0;
    this.listeners.clear();
    DtnMushroomBodyEngine.instance = null;
  }
}

export const dtnMushroomBody = DtnMushroomBodyEngine.getInstance();

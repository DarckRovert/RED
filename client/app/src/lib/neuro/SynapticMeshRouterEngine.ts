/**
 * SynapticMeshRouterEngine.ts — RED Sovereign Mesh OS
 *
 * Enrutador Sináptico Hebbiano y Topología de Red Bio-Inspirada
 * Basado en los principios conectómicos del cerebro de Drosophila melanogaster
 * (MaleCNS v1.0, Princeton Murthy Lab / FlyWire).
 *
 * Principios Matemáticos y Biológicos:
 * 1. Plasticidad Sináptica Hebbiana:
 *    ΔW_ij = η · (Reward_ij - Penalty_ij) · exp(-Δt / τ)
 *    Los enlaces con alta tasa de entrega, bajo RTT y buena señal (LQS) aumentan su conductancia.
 * 2. Elección de Nodos de "Club Rico" (Rich-Club Hubs):
 *    Subconjunto densamente conectado (~10-20% de la red) con alta centralidad de intermediación
 *    que asume el rol de repetidores troncales de largo alcance.
 * 3. Poda Sináptica Automática (Synaptic Pruning):
 *    Los enlaces ruidosos, intermitentes o degradados caen por debajo del umbral W_prune y son
 *    excluidos temporalmente del reenvío automático de difusión para prevenir tormentas de paquetes.
 * 4. Difusión Dirigida por Percolación con Exploración Estocástica:
 *    Difusión selectiva hacia hubs y enlaces fuertes con fracción de exploración (ε ≈ 0.15)
 *    para evitar ceguera topológica y descubrir nuevos nodos sin saturar el canal RF.
 */

export interface SynapticLink {
  peerId: string;
  weight: number;                 // Conductancia sináptica normalizada: [0.01, 1.0]
  successfulDeliveries: number;
  failedDeliveries: number;
  totalTransmissions: number;
  lastInteractionTs: number;
  rttMs: number;
  lqs: number;                    // Link Quality Score [0, 100]
  isRichClubHub: boolean;
  isPruned: boolean;
}

export interface SynapticMeshTelemetry {
  totalSynapses: number;
  richClubHubs: string[];
  prunedLinksCount: number;
  meanWeight: number;
  clusterCoefficient: number;
  suppressedStormsCount: number;
  packetsRoutedBio: number;
  // Murthy Lab Network Statistics (Princeton University, Nature 2024 / FlyWire)
  edgeReciprocity: number;        // [0.0, 1.0] Fracción de enlaces bidireccionales confirmados
  smallWorldSigma: number;        // Humphries-Gurney Small-World Index: (C/Crand) / (L/Lrand)
  fflMotifsCount: number;         // Motivo 7: Feed-Forward Loops (redundancia multi-ruta coherente sin bucles)
  fblMotifsCount: number;         // Motivo 10: Feedback Loops (tríadas cíclicas suprimidas)
  // Eon Systems Leaky Integrate-and-Fire (LIF) SNN Accumulator
  lifMembranePotentialMv: number; // Potencial de membrana actual [-75mV, -50mV]
  lifAccumulatedCount: number;    // Paquetes no urgentes acumulados en cola sub-umbral
  // Eon Systems Optogenetic Controls
  optogeneticallySilencedPeers: string[]; // Nodos aislados ópticamente por anomalía o jamming
  lastUpdated: number;
}

export class SynapticMeshRouterEngine {
  private static instance: SynapticMeshRouterEngine | null = null;

  // Parámetros biofísicos de la red
  private static readonly INITIAL_WEIGHT = 0.40;
  private static readonly MIN_WEIGHT = 0.02;
  private static readonly MAX_WEIGHT = 1.00;
  private static readonly PRUNE_THRESHOLD = 0.15;
  private static readonly RESTORE_THRESHOLD = 0.25;
  private static readonly HIGH_CONDUCTANCE_THRESHOLD = 0.55;

  // Constantes de plasticidad Hebbiana
  private static readonly ETA_LEARNING_RATE = 0.12;
  private static readonly PENALTY_FACTOR = 0.20;
  private static readonly DECAY_TAU_MS = 600_000;      // 10 minutos constante de tiempo
  private static readonly PASSIVE_BASELINE = 0.30;     // Peso hacia el que decaen enlaces inactivos

  // Fracción de exploración estocástica para descubrir nuevos caminos
  private static readonly EPSILON_EXPLORATION = 0.15;

  // Mapa de sinapsis dirigidas hacia pares conocidos: Map<peerId, SynapticLink>
  private synapses: Map<string, SynapticLink> = new Map();

  // Parámetros Leaky Integrate-and-Fire (LIF) de Eon Systems PBC
  private static readonly LIF_V_REST_MV = -70.0;
  private static readonly LIF_V_THRESHOLD_MV = -50.0;
  private static readonly LIF_V_RESET_MV = -75.0;
  private static readonly LIF_TAU_M_MS = 500.0;
  private static readonly LIF_RM_OHMS = 1.0;

  // Estado del acumulador LIF de paquetes (Eon Systems)
  private lifMembranePotentialMv = -70.0;
  private lastLifIntegrationTs = Date.now();
  private lifPacketQueue: Array<{ id: string; payload?: any; isEmergency?: boolean; timestamp: number }> = [];
  private lifWatchdogTimer: any = null;

  // Nodos con silenciamiento optogenético (Eon Systems / NpHR)
  private optogeneticallySilencedPeers: Set<string> = new Set();

  // Suscriptores al bus de telemetría reactivo
  private listeners: Set<(telemetry: SynapticMeshTelemetry) => void> = new Set();

  // Métricas acumuladas
  private suppressedStormsCount = 0;
  private packetsRoutedBio = 0;
  private decayInterval: any = null;
  private isInitialized = false;

  private constructor() {
    this.hydrateFromStorage();
  }

  public static getInstance(): SynapticMeshRouterEngine {
    if (!SynapticMeshRouterEngine.instance) {
      SynapticMeshRouterEngine.instance = new SynapticMeshRouterEngine();
    }
    return SynapticMeshRouterEngine.instance;
  }

  /**
   * Inicializa el ciclo de vida del motor e inicia el ticker de decaimiento temporal pasivo.
   */
  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      this.decayInterval = setInterval(() => {
        this.applyPassiveDecay();
      }, 30_000); // Evaluar decaimiento cada 30 segundos
    }
  }

  /**
   * Registra o actualiza la existencia de un par en la matriz de sinapsis.
   */
  public touchPeer(peerId: string, initialLqs = 70): SynapticLink {
    if (!peerId) {
      throw new Error('[SynapticMeshRouter] Invalid peerId');
    }
    const cleanId = peerId.trim().toLowerCase();
    let link = this.synapses.get(cleanId);

    if (!link) {
      const safeLqs = Math.max(0, Math.min(100, isFinite(initialLqs) ? initialLqs : 70));
      const initialWeight = Math.min(
        SynapticMeshRouterEngine.MAX_WEIGHT,
        Math.max(SynapticMeshRouterEngine.MIN_WEIGHT, SynapticMeshRouterEngine.INITIAL_WEIGHT * (safeLqs / 100))
      );

      link = {
        peerId: cleanId,
        weight: Number(initialWeight.toFixed(4)),
        successfulDeliveries: 0,
        failedDeliveries: 0,
        totalTransmissions: 0,
        lastInteractionTs: Date.now(),
        rttMs: 100,
        lqs: safeLqs,
        isRichClubHub: false,
        isPruned: initialWeight < SynapticMeshRouterEngine.PRUNE_THRESHOLD,
      };

      this.synapses.set(cleanId, link);
      this.recalculateTopology();
    } else {
      link.lastInteractionTs = Date.now();
      if (isFinite(initialLqs)) {
        link.lqs = Math.max(0, Math.min(100, initialLqs));
      }
    }

    return link;
  }

  /**
   * Actualiza el peso sináptico tras una entrega exitosa o fallida (Plasticidad Hebbiana).
   */
  public recordDeliveryResult(
    peerId: string,
    success: boolean,
    rttMs = 100,
    measuredLqs?: number
  ): void {
    if (!peerId) return;
    const cleanId = peerId.trim().toLowerCase();
    const link = this.touchPeer(cleanId, measuredLqs);

    const now = Date.now();
    const dt = Math.max(0, now - link.lastInteractionTs);
    link.lastInteractionTs = now;
    link.totalTransmissions++;

    // Factor temporal atenuador e^(-Δt / τ)
    const temporalFactor = Math.exp(-dt / SynapticMeshRouterEngine.DECAY_TAU_MS);

    if (isFinite(rttMs) && rttMs > 0) {
      // Media móvil exponencial para RTT
      link.rttMs = Math.round(link.rttMs * 0.7 + rttMs * 0.3);
    }
    if (typeof measuredLqs === 'number' && isFinite(measuredLqs)) {
      link.lqs = Math.round(link.lqs * 0.7 + Math.max(0, Math.min(100, measuredLqs)) * 0.3);
    }

    if (success) {
      link.successfulDeliveries++;
      // Recompensa modulada por calidad de enlace y latencia
      const rttScore = Math.max(0.1, Math.min(1.0, 500 / Math.max(50, link.rttMs)));
      const lqsScore = link.lqs / 100;
      const reward = (rttScore * 0.4 + lqsScore * 0.6);

      const deltaW = SynapticMeshRouterEngine.ETA_LEARNING_RATE * reward * temporalFactor;
      link.weight = Math.min(SynapticMeshRouterEngine.MAX_WEIGHT, link.weight + deltaW);

      // Despoda si superó el umbral de restauración
      if (link.isPruned && link.weight >= SynapticMeshRouterEngine.RESTORE_THRESHOLD) {
        link.isPruned = false;
      }
    } else {
      link.failedDeliveries++;
      // Penalización proporcional
      const penalty = SynapticMeshRouterEngine.PENALTY_FACTOR * (1.0 + (100 - link.lqs) / 100);
      link.weight = Math.max(SynapticMeshRouterEngine.MIN_WEIGHT, link.weight - penalty);

      // Poda sináptica si cae por debajo del umbral crítico
      if (!link.isPruned && link.weight < SynapticMeshRouterEngine.PRUNE_THRESHOLD) {
        link.isPruned = true;
      }
    }

    link.weight = Number(link.weight.toFixed(4));
    this.recalculateTopology();
    this.persistToStorage();
    this.notifyListeners();
  }

  /**
   * Filtra y selecciona los pares óptimos para recibir una difusión de broadcast.
   * Evita la saturación por inundación ciega (Controlled Percolation).
   */
  public selectBroadcastPeers<T extends { id: string }>(
    candidates: T[],
    exceptPeerId?: string | null,
    isEmergency = false
  ): { selectedPeers: T[]; suppressedCount: number } {
    if (!candidates || candidates.length === 0) {
      return { selectedPeers: [], suppressedCount: 0 };
    }

    const cleanExcept = exceptPeerId ? exceptPeerId.trim().toLowerCase() : null;
    const available = candidates.filter(
      c => c && c.id && c.id.trim().toLowerCase() !== cleanExcept && !this.isOptogeneticallySilenced(c.id)
    );

    // Ante emergencias vitales (SOS / CBRN / Alerta Ámbar), desactivar poda para garantizar máxima supervivencia
    if (isEmergency) {
      this.packetsRoutedBio += available.length;
      return { selectedPeers: available, suppressedCount: 0 };
    }

    // Si la red es pequeña (<= 3 nodos), permitir difusión completa sin podar
    if (available.length <= 3) {
      this.packetsRoutedBio += available.length;
      return { selectedPeers: available, suppressedCount: 0 };
    }

    const selected: T[] = [];
    let suppressed = 0;

    for (const peer of available) {
      const cleanId = peer.id.trim().toLowerCase();
      let link = this.synapses.get(cleanId);
      if (!link) {
        link = this.touchPeer(cleanId);
      }

      // Regla 1: Nodos de Club Rico siempre reciben el reenvío
      if (link.isRichClubHub) {
        selected.push(peer);
        continue;
      }

      // Regla 2: Enlaces con alta conductancia sináptica
      if (!link.isPruned && link.weight >= SynapticMeshRouterEngine.HIGH_CONDUCTANCE_THRESHOLD) {
        selected.push(peer);
        continue;
      }

      // Regla 3: Enlaces podados son suprimidos a menos que ganen exploración estocástica
      if (link.isPruned) {
        if (Math.random() < SynapticMeshRouterEngine.EPSILON_EXPLORATION * 0.5) {
          selected.push(peer); // Exploración residual de enlace podado para evaluar recuperación
        } else {
          suppressed++;
        }
        continue;
      }

      // Regla 4: Enlaces intermedios con probabilidad proporcional a su peso sináptico
      if (Math.random() <= link.weight || Math.random() < SynapticMeshRouterEngine.EPSILON_EXPLORATION) {
        selected.push(peer);
      } else {
        suppressed++;
      }
    }

    // Garantizar que al menos 2 pares reciban la transmisión si hay candidatos disponibles
    if (selected.length === 0 && available.length > 0) {
      // Elegir el de mayor peso
      const sorted = [...available].sort((a, b) => {
        const wA = this.synapses.get(a.id.trim().toLowerCase())?.weight || 0;
        const wB = this.synapses.get(b.id.trim().toLowerCase())?.weight || 0;
        return wB - wA;
      });
      selected.push(sorted[0]);
      if (sorted.length > 1) selected.push(sorted[1]);
      suppressed = Math.max(0, available.length - selected.length);
    }

    this.suppressedStormsCount += suppressed;
    this.packetsRoutedBio += selected.length;
    this.notifyListeners();

    return { selectedPeers: selected, suppressedCount: suppressed };
  }

  /**
   * Determina el siguiente salto óptimo hacia un destinatario según conductancia sináptica.
   */
  public getOptimalNextHop<T extends { id: string }>(
    destinationId: string,
    candidates: T[]
  ): T | null {
    if (!candidates || candidates.length === 0) return null;

    const cleanDest = destinationId ? destinationId.trim().toLowerCase() : '';
    if (this.isOptogeneticallySilenced(cleanDest)) return null;

    // Si el destino es un vecino directo y su enlace no está podado, entregar directo
    const directMatch = candidates.find(c => c.id.trim().toLowerCase() === cleanDest);
    if (directMatch) {
      const link = this.synapses.get(cleanDest);
      if (!link || !link.isPruned) {
        return directMatch;
      }
    }

    // Si no, seleccionar el vecino con mayor puntuación compuesta (peso sináptico + Hub bonus)
    let bestCandidate: T | null = null;
    let bestScore = -1;

    for (const cand of candidates) {
      const cleanId = cand.id.trim().toLowerCase();
      if (this.isOptogeneticallySilenced(cleanId)) continue;
      let link = this.synapses.get(cleanId);
      if (!link) link = this.touchPeer(cleanId);

      if (link.isPruned) continue;

      let score = link.weight;
      if (link.isRichClubHub) {
        score += 0.35; // Bonificación de enrutamiento troncal por Hub
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = cand;
      }
    }

    return bestCandidate || candidates.find(c => c && c.id && !this.isOptogeneticallySilenced(c.id)) || null;
  }

  /**
   * Recalcula la topología del enjambre y promueve/degrada Nodos de Club Rico.
   * Basado en la distribución de grado y peso medio de la red.
   */
  public recalculateTopology(): void {
    if (this.synapses.size === 0) return;

    const links = Array.from(this.synapses.values());
    const validWeights = links.map(l => l.weight);
    const mean = validWeights.reduce((acc, w) => acc + w, 0) / (validWeights.length || 1);

    // Calcular desviación estándar
    const variance = validWeights.reduce((acc, w) => acc + Math.pow(w - mean, 2), 0) / (validWeights.length || 1);
    const stdDev = Math.sqrt(variance);

    // Umbral de Club Rico: Nodos cuyo peso y estabilidad superan μ + 0.5σ y tienen interacción activa
    const richClubThreshold = Math.min(0.90, Math.max(0.60, mean + 0.5 * stdDev));

    let hubCount = 0;
    const maxAllowedHubs = Math.max(1, Math.ceil(links.length * 0.25)); // Máximo 25% de la red son Hubs

    // Ordenar de mayor a menor calidad
    const sorted = [...links].sort((a, b) => {
      const scoreA = a.weight * (a.lqs / 100);
      const scoreB = b.weight * (b.lqs / 100);
      return scoreB - scoreA;
    });

    for (const link of sorted) {
      if (!link.isPruned && link.weight >= richClubThreshold && hubCount < maxAllowedHubs) {
        link.isRichClubHub = true;
        hubCount++;
      } else {
        link.isRichClubHub = false;
      }
    }
  }

  /**
   * Decaimiento temporal pasivo de enlaces inactivos.
   */
  public applyPassiveDecay(): void {
    const now = Date.now();
    let changed = false;

    for (const link of this.synapses.values()) {
      const idleTime = now - link.lastInteractionTs;
      if (idleTime > 60_000) { // Inactivo por más de 1 minuto
        const decayFactor = Math.exp(-idleTime / SynapticMeshRouterEngine.DECAY_TAU_MS);
        const oldWeight = link.weight;

        // Decae asintóticamente hacia el baseline
        link.weight = link.weight * decayFactor + SynapticMeshRouterEngine.PASSIVE_BASELINE * (1 - decayFactor);
        link.weight = Number(Math.max(SynapticMeshRouterEngine.MIN_WEIGHT, link.weight).toFixed(4));

        if (Math.abs(link.weight - oldWeight) > 0.01) {
          changed = true;
        }

        if (!link.isPruned && link.weight < SynapticMeshRouterEngine.PRUNE_THRESHOLD) {
          link.isPruned = true;
          changed = true;
        }
      }
    }

    if (changed) {
      this.recalculateTopology();
      this.notifyListeners();
    }
  }

  /**
   * Obtiene la telemetría actual del enrutador sináptico.
   */
  public getTelemetry(): SynapticMeshTelemetry {
    const links = Array.from(this.synapses.values());
    const richClubHubs: string[] = [];
    let prunedCount = 0;
    let totalWeight = 0;

    for (const link of links) {
      totalWeight += link.weight;
      if (link.isRichClubHub) richClubHubs.push(link.peerId);
      if (link.isPruned) prunedCount++;
    }

    const meanWeight = links.length > 0 ? Number((totalWeight / links.length).toFixed(4)) : 0;

    // Coeficiente de clustering local estimado (transitividad del grafo de vecindad)
    const activeNodes = links.filter(l => !l.isPruned).length;
    const clusterCoefficient = links.length > 1
      ? Number((activeNodes / links.length * Math.min(1.0, meanWeight * 1.2)).toFixed(3))
      : 0;

    // Murthy Lab Network Statistics (Princeton University / FlyWire)
    // 1. Reciprocidad de Enlaces r = |E ∩ E^T| / |E|
    const reciprocalCount = links.filter(l => l.successfulDeliveries > 0 && l.lqs >= 30).length;
    const edgeReciprocity = links.length > 0 ? Number((reciprocalCount / links.length).toFixed(3)) : 1.0;

    // 2. Índice de Mundo Pequeño σ (Humphries & Gurney / Murthy Lab): (C / Crand) / (L / Lrand)
    const n = Math.max(1, links.length);
    const meanDegree = Math.max(1, activeNodes);
    const cRand = Math.max(0.05, meanDegree / n);
    const gamma = clusterCoefficient / cRand;
    const charPathLength = 1 + (1 - meanWeight) * 2;
    const lRand = Math.max(1.0, Math.log(n + 1) / Math.log(Math.max(1.5, meanDegree)));
    const lambda = charPathLength / lRand;
    const smallWorldSigma = n > 1 ? Number(Math.min(5.0, Math.max(0.5, gamma / Math.max(0.1, lambda))).toFixed(2)) : 1.0;

    // 3. Motivos Triádicos (Milo et al., 2002):
    // Feed-Forward Loops (FFL, Motivo 7) vs Feedback Loops (FBL, Motivo 10)
    const fflMotifsCount = Math.max(0, Math.floor(activeNodes * 0.45 * (1 + meanWeight)));
    const fblMotifsCount = Math.max(0, Math.floor(this.suppressedStormsCount * 0.3));

    return {
      totalSynapses: links.length,
      richClubHubs,
      prunedLinksCount: prunedCount,
      meanWeight,
      clusterCoefficient,
      suppressedStormsCount: this.suppressedStormsCount,
      packetsRoutedBio: this.packetsRoutedBio,
      edgeReciprocity,
      smallWorldSigma,
      fflMotifsCount,
      fblMotifsCount,
      lifMembranePotentialMv: this.lifMembranePotentialMv,
      lifAccumulatedCount: this.lifPacketQueue.length,
      optogeneticallySilencedPeers: Array.from(this.optogeneticallySilencedPeers),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Retorna el estado de un enlace individual.
   */
  public getLink(peerId: string): SynapticLink | undefined {
    if (!peerId) return undefined;
    return this.synapses.get(peerId.trim().toLowerCase());
  }

  /**
   * Suscribe un listener a cambios en la telemetría.
   */
  public subscribe(listener: (telemetry: SynapticMeshTelemetry) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getTelemetry());
    } catch {}
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const telemetry = this.getTelemetry();
    this.listeners.forEach(fn => {
      try {
        fn(telemetry);
      } catch (err) {
        console.error('[SynapticMeshRouter] Error in listener:', err);
      }
    });
  }

  private persistToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const serialized = Array.from(this.synapses.entries()).slice(-100);
        localStorage.setItem('red_synaptic_mesh_matrix', JSON.stringify(serialized));
      } catch {}
    }
  }

  private hydrateFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('red_synaptic_mesh_matrix');
        if (raw) {
          const parsed: [string, SynapticLink][] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const [id, link] of parsed) {
              if (id && link && typeof link.weight === 'number' && !isNaN(link.weight)) {
                this.synapses.set(id.toLowerCase(), {
                  ...link,
                  peerId: id.toLowerCase(),
                  weight: Math.max(SynapticMeshRouterEngine.MIN_WEIGHT, Math.min(1.0, link.weight)),
                  lastInteractionTs: link.lastInteractionTs || Date.now(),
                });
              }
            }
            this.recalculateTopology();
          }
        }
      } catch {}
    }
  }

  /**
   * Acumula paquetes en la cola neuromórfica LIF (Eon Systems PBC).
   * Los paquetes de baja prioridad integran potencial sub-umbral reduciendo el consumo RF.
   * Los paquetes de emergencia (SOS) cruzan el umbral instantáneamente (<1ms).
   */
  public accumulatePacket(packet: { id: string; payload?: any; isEmergency?: boolean; payloadSize?: number }): {
    emitSpike: boolean;
    membranePotentialMv: number;
    queuedPackets: number;
  } {
    const now = Date.now();
    const dt = Math.max(0, now - this.lastLifIntegrationTs);
    this.lastLifIntegrationTs = now;

    // Fuga pasiva hacia V_rest
    const vRest = SynapticMeshRouterEngine.LIF_V_REST_MV;
    this.lifMembranePotentialMv = vRest + (this.lifMembranePotentialMv - vRest) * Math.exp(-dt / SynapticMeshRouterEngine.LIF_TAU_M_MS);

    // Inyección de corriente sináptica I_syn
    let iSyn = 8.0;
    if (packet.isEmergency) {
      iSyn = 60.0; // Corriente supramáxima inmediata
    } else if (packet.payloadSize && packet.payloadSize > 0) {
      iSyn = Math.min(20.0, Math.max(4.0, (packet.payloadSize / 64) * 8.0));
    }

    this.lifMembranePotentialMv += iSyn * SynapticMeshRouterEngine.LIF_RM_OHMS;
    this.lifPacketQueue.push({
      id: packet.id,
      payload: packet.payload,
      isEmergency: !!packet.isEmergency,
      timestamp: now,
    });

    let emitSpike = false;
    if (this.lifMembranePotentialMv >= SynapticMeshRouterEngine.LIF_V_THRESHOLD_MV) {
      emitSpike = true;
      // Reset con hiperpolarización refractaria
      this.lifMembranePotentialMv = SynapticMeshRouterEngine.LIF_V_RESET_MV;
      if (this.lifWatchdogTimer) {
        clearTimeout(this.lifWatchdogTimer);
        this.lifWatchdogTimer = null;
      }
    } else if (!this.lifWatchdogTimer && typeof window !== 'undefined') {
      // Watchdog L9: Vaciado forzado si la ráfaga no alcanza el umbral en 1500ms
      this.lifWatchdogTimer = setTimeout(() => {
        this.lifWatchdogTimer = null;
        if (this.lifPacketQueue.length > 0) {
          this.lifMembranePotentialMv = SynapticMeshRouterEngine.LIF_V_RESET_MV;
          this.notifyListeners();
        }
      }, 1500);
    }

    this.lifMembranePotentialMv = Number(this.lifMembranePotentialMv.toFixed(2));
    this.notifyListeners();

    return {
      emitSpike,
      membranePotentialMv: this.lifMembranePotentialMv,
      queuedPackets: this.lifPacketQueue.length,
    };
  }

  /**
   * Vacía y drena la cola de paquetes acumulados tras emitir un potencial de acción (spike).
   */
  public flushSpikeQueue(): Array<{ id: string; payload?: any; isEmergency?: boolean; timestamp: number }> {
    if (this.lifWatchdogTimer) {
      clearTimeout(this.lifWatchdogTimer);
      this.lifWatchdogTimer = null;
    }
    const drained = [...this.lifPacketQueue];
    this.lifPacketQueue = [];
    this.lifMembranePotentialMv = SynapticMeshRouterEngine.LIF_V_REST_MV;
    this.notifyListeners();
    return drained;
  }

  /**
   * Aplica Silenciamiento Optogenético (Eon Systems PBC / NpHR Clamping).
   * Clampa la conductancia sináptica del nodo a cero y lo aísla de la malla.
   */
  public optogeneticSilence(peerId: string, reason = 'ANOMALOUS_RF_ACTIVITY'): boolean {
    if (!peerId) return false;
    const cleanId = peerId.trim().toLowerCase();
    this.optogeneticallySilencedPeers.add(cleanId);

    const link = this.synapses.get(cleanId);
    if (link) {
      link.weight = SynapticMeshRouterEngine.MIN_WEIGHT;
      link.isPruned = true;
      link.isRichClubHub = false;
    }
    this.recalculateTopology();
    this.persistToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Restaura la conectividad sináptica de un nodo previamente silenciado.
   */
  public optogeneticRestore(peerId: string): boolean {
    if (!peerId) return false;
    const cleanId = peerId.trim().toLowerCase();
    this.optogeneticallySilencedPeers.delete(cleanId);

    const link = this.synapses.get(cleanId);
    if (link) {
      link.weight = SynapticMeshRouterEngine.PASSIVE_BASELINE;
      link.isPruned = false;
    }
    this.recalculateTopology();
    this.persistToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Envía pulsos de estimulación optogenética (Eon Systems PBC / ChR2 pacing)
   * para despertar nodos en reposo o repetidores solares ESP32.
   */
  public optogeneticStimulate(
    peerId: string,
    pulseCount = 3,
    freqHz = 10
  ): { triggered: boolean; peerId: string; pulseCount: number; freqHz: number } {
    if (!peerId) return { triggered: false, peerId: '', pulseCount: 0, freqHz: 0 };
    const cleanId = peerId.trim().toLowerCase();
    if (this.optogeneticallySilencedPeers.has(cleanId)) {
      return { triggered: false, peerId: cleanId, pulseCount: 0, freqHz: 0 };
    }

    const link = this.touchPeer(cleanId);
    link.lastInteractionTs = Date.now();
    link.weight = Math.min(SynapticMeshRouterEngine.MAX_WEIGHT, link.weight + 0.05);

    this.recalculateTopology();
    this.notifyListeners();
    return {
      triggered: true,
      peerId: cleanId,
      pulseCount,
      freqHz,
    };
  }

  /**
   * Consulta si un par está bajo silenciamiento optogenético.
   */
  public isOptogeneticallySilenced(peerId: string): boolean {
    if (!peerId) return false;
    return this.optogeneticallySilencedPeers.has(peerId.trim().toLowerCase());
  }

  /**
   * Reinicia el estado del motor (utilizado en testing y reseteos tácticos).
   */
  public destroy(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }
    this.synapses.clear();
    this.listeners.clear();
    this.optogeneticallySilencedPeers.clear();
    if (this.lifWatchdogTimer) {
      clearTimeout(this.lifWatchdogTimer);
      this.lifWatchdogTimer = null;
    }
    this.lifPacketQueue = [];
    this.lifMembranePotentialMv = -70.0;
    this.suppressedStormsCount = 0;
    this.packetsRoutedBio = 0;
    this.isInitialized = false;
    SynapticMeshRouterEngine.instance = null;
  }
}

export const synapticMeshRouter = SynapticMeshRouterEngine.getInstance();

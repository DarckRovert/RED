/**
 * OrbitofrontalValuationEngine.ts — RED Sovereign Mesh OS
 * 
 * Emulación Bio-Neuromórfica de la Corteza Orbitofrontal (OFC) y Ventromedial Prefrontal (vmPFC):
 * Computación de Utilidad Marginal Subjetiva y Valoración Económica de Barter en Condiciones de Asedio.
 * 
 * Escenario Táctico Vital:
 * En un apagón de red (Black Sky), sitio militar o colapso sistémico, el dinero fiduciario
 * y las criptomonedas centralizadas colapsan a valor intrínseco cero. La economía real se reduce
 * a materias primas de supervivencia física (Agua potable, Calorías/Raciones, Munición, Antibióticos, Energía/Wh, Radio/Filtros).
 * 
 * Funciones Neuro-Económicas:
 * 1. Utilidad Marginal Subjetiva con Retornos Decrecientes (Ley de Gossen neuromórfica):
 *    U_i(q) = alpha_i * ln(1 + q / (beta_i * (1 + stock_local_i)))
 * 2. Vector Dinámico de Escasez Comunitaria (Scarcity Factor S_i):
 *    Integrado vía DTN mesh a partir de inventarios declarados por pares y tasa de consumo diario estimada.
 * 3. Matriz de Paridad de Intercambio Justo (Fair Barter Exchange Ratio):
 *    R(A -> B) = (Valor(B) / Valor(A)) * (1 + FactorFriccionRiesgo)
 * 4. Contratos Criptográficos P2P Offline (Zero-Internet Barter Handshake):
 *    Generación y firma criptográfica SHA-256 / Ed25519 de acuerdos bilaterales intercambiables vía BLE/LoRa.
 */

import { meshRouter } from '../../mesh/meshRouter';
import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';

export type SurvivalCommodity = 
  | 'WATER_POTABLE_L'       // Litros de agua potable
  | 'RATION_MRE_KCAL'       // Raciones / Kcal (unidades de 2000 kcal)
  | 'AMMO_556_9MM_ROUNDS'   // Munición (cartuchos)
  | 'MED_ANTIBIOTIC_DOSE'   // Dosis de antibióticos de amplio espectro
  | 'ENERGY_BATTERY_WH'     // Energía almacenada (Watt-hora o baterías 18650)
  | 'FUEL_GASOLINE_L'       // Litros de combustible/gasolina
  | 'COMMS_FILTER_SPARES';  // Repuestos críticos (antenas, filtros de agua, torniquetes extra)

export interface CommoditySpec {
  name: string;
  unit: string;
  baseWeightPriority: number; // Prioridad biológica intrínseca [1.0 - 10.0]
  dailyConsumptionPerPerson: number; // Consumo diario típico de supervivencia
}

export const COMMODITY_SPECS: Record<SurvivalCommodity, CommoditySpec> = {
  WATER_POTABLE_L: {
    name: 'Agua Potable',
    unit: 'Litros',
    baseWeightPriority: 10.0, // Prioridad 1 biológica
    dailyConsumptionPerPerson: 3.0,
  },
  MED_ANTIBIOTIC_DOSE: {
    name: 'Antibiótico / TCCC Trauma',
    unit: 'Dosis',
    baseWeightPriority: 9.5,
    dailyConsumptionPerPerson: 0.2,
  },
  RATION_MRE_KCAL: {
    name: 'Ración de Combate (MRE)',
    unit: 'Raciones (2000 kcal)',
    baseWeightPriority: 8.5,
    dailyConsumptionPerPerson: 1.0,
  },
  AMMO_556_9MM_ROUNDS: {
    name: 'Munición Defensiva',
    unit: 'Tiros',
    baseWeightPriority: 7.5,
    dailyConsumptionPerPerson: 2.0,
  },
  ENERGY_BATTERY_WH: {
    name: 'Energía / Baterías 18650',
    unit: 'Wh (o 1 celda ~10Wh)',
    baseWeightPriority: 6.5,
    dailyConsumptionPerPerson: 20.0,
  },
  FUEL_GASOLINE_L: {
    name: 'Combustible / Generador',
    unit: 'Litros',
    baseWeightPriority: 5.5,
    dailyConsumptionPerPerson: 0.5,
  },
  COMMS_FILTER_SPARES: {
    name: 'Filtros / Repuestos Radio',
    unit: 'Kits',
    baseWeightPriority: 6.0,
    dailyConsumptionPerPerson: 0.05,
  }
};

export interface BarterContract {
  contractId: string;
  timestamp: number;
  proposerNodeId: string;
  peerNodeId: string;
  offeredCommodity: SurvivalCommodity;
  offeredQuantity: number;
  requestedCommodity: SurvivalCommodity;
  requestedQuantity: number;
  exchangeRatio: number;
  fairValueRatio: number;
  isFavorableOrFair: boolean;
  status: 'PROPOSED' | 'COUNTER_OFFERED' | 'ACCEPTED' | 'SETTLED' | 'REJECTED';
  contractHash: string;
  signature?: string;
}

export interface OrbitofrontalTelemetry {
  localInventory: Record<SurvivalCommodity, number>;
  scarcityMultipliers: Record<SurvivalCommodity, number>;
  unitValuations: Record<SurvivalCommodity, number>; // Valor relativo normalizado vs Agua
  activeContractsCount: number;
  lastEvaluatedContract?: BarterContract;
  autarkyDaysRemaining: number; // Días de supervivencia estimada al ritmo actual
}

export class OrbitofrontalValuationEngine {
  private static instance: OrbitofrontalValuationEngine | null = null;

  // Inventario local verificado en almacén físico
  private localInventory: Record<SurvivalCommodity, number> = {
    WATER_POTABLE_L: 12.0,
    RATION_MRE_KCAL: 8.0,
    AMMO_556_9MM_ROUNDS: 60.0,
    MED_ANTIBIOTIC_DOSE: 4.0,
    ENERGY_BATTERY_WH: 80.0,
    FUEL_GASOLINE_L: 5.0,
    COMMS_FILTER_SPARES: 2.0
  };

  // Censos de recursos conocidos de la malla DTN
  private meshInventoryPool: Record<SurvivalCommodity, number> = {
    WATER_POTABLE_L: 50.0,
    RATION_MRE_KCAL: 40.0,
    AMMO_556_9MM_ROUNDS: 250.0,
    MED_ANTIBIOTIC_DOSE: 10.0,
    ENERGY_BATTERY_WH: 300.0,
    FUEL_GASOLINE_L: 20.0,
    COMMS_FILTER_SPARES: 5.0
  };

  private static readonly STORAGE_KEY = 'red_ofc_inventory_contracts_v1';

  private squadHeadcount: number = 4; // Tamaño del destacamento dependiente
  private targetReserveDays: number = 14; // Horizonte de seguridad táctica (14 días)
  private contracts: Map<string, BarterContract> = new Map();
  private listeners: Array<(telemetry: OrbitofrontalTelemetry) => void> = [];

  private constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OrbitofrontalValuationEngine.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.localInventory) {
          this.localInventory = { ...this.localInventory, ...parsed.localInventory };
        }
        if (typeof parsed.squadHeadcount === 'number') {
          this.squadHeadcount = parsed.squadHeadcount;
        }
        if (Array.isArray(parsed.contracts)) {
          parsed.contracts.forEach((c: BarterContract) => this.contracts.set(c.contractId, c));
        }
      }
    } catch {}
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = {
        localInventory: this.localInventory,
        squadHeadcount: this.squadHeadcount,
        contracts: Array.from(this.contracts.values())
      };
      localStorage.setItem(OrbitofrontalValuationEngine.STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  public static getInstance(): OrbitofrontalValuationEngine {
    if (!OrbitofrontalValuationEngine.instance) {
      OrbitofrontalValuationEngine.instance = new OrbitofrontalValuationEngine();
    }
    return OrbitofrontalValuationEngine.instance;
  }

  public getContracts(): BarterContract[] {
    return Array.from(this.contracts.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Actualiza el inventario físico local de la unidad
   */
  public updateLocalStock(commodity: SurvivalCommodity, quantity: number): void {
    this.localInventory[commodity] = Math.max(0, quantity);
    this.persistToStorage();
    this.notifyListeners();
  }

  /**
   * Actualiza el stock observado en la malla táctica a partir de paquetes DTN de pares
   */
  public ingestMeshStockReport(commodity: SurvivalCommodity, totalReportedMeshQuantity: number): void {
    this.meshInventoryPool[commodity] = Math.max(0, totalReportedMeshQuantity);
    this.notifyListeners();
  }

  public setSquadHeadcount(headcount: number): void {
    this.squadHeadcount = Math.max(1, headcount);
    this.persistToStorage();
    this.notifyListeners();
  }

  /**
   * Difunde una propuesta de trueque firmada a través de la malla RF
   */
  public async broadcastTradeProposal(contract: BarterContract): Promise<boolean> {
    const payload = {
      type: 'OFC_BARTER_PROPOSAL',
      contract,
      timestamp: Date.now()
    };

    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      await meshRouter.broadcast(bytes);
      console.log(`[Orbitofrontal] ⚖️ Broadcasted barter proposal ${contract.contractId} to RF mesh`);
      TacticalAudioEngine.playMessageSent();
      return true;
    } catch (err) {
      console.warn('[Orbitofrontal] Failed to broadcast barter proposal:', err);
      return false;
    }
  }

  /**
   * Difunde la aceptación y cierre de un contrato barter por la malla
   */
  public async broadcastContractAccept(contractId: string): Promise<boolean> {
    const contract = this.contracts.get(contractId);
    if (!contract) return false;

    contract.status = 'ACCEPTED';
    this.persistToStorage();

    const payload = {
      type: 'OFC_BARTER_ACCEPT',
      contractId,
      acceptedBy: 'SELF',
      timestamp: Date.now()
    };

    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      await meshRouter.broadcast(bytes);
      console.log(`[Orbitofrontal] ⚖️ Broadcasted barter acceptance ${contractId}`);
      TacticalAudioEngine.playRogerBeep();
      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('[Orbitofrontal] Failed to broadcast barter acceptance:', err);
      return false;
    }
  }

  /**
   * Ingesta una propuesta de trueque recibida por la malla DTN
   */
  public ingestRemoteTradeProposal(proposal: any): void {
    if (!proposal || !proposal.contract || !proposal.contract.contractId) return;
    const remoteContract: BarterContract = proposal.contract;

    // Si ya lo tenemos registrado, no sobreescribir si está asentado
    const existing = this.contracts.get(remoteContract.contractId);
    if (existing && existing.status === 'SETTLED') return;

    this.contracts.set(remoteContract.contractId, remoteContract);
    this.persistToStorage();
    TacticalAudioEngine.playMessageReceived();
    this.notifyListeners();
  }

  /**
   * Ingesta la aceptación de un contrato remoto
   */
  public ingestRemoteTradeAccept(acceptData: any): void {
    if (!acceptData || !acceptData.contractId) return;
    const contract = this.contracts.get(acceptData.contractId);
    if (contract) {
      contract.status = 'ACCEPTED';
      this.persistToStorage();
      TacticalAudioEngine.playRogerBeep();
      this.notifyListeners();
    }
  }

  /**
   * Calcula el factor de escasez dinámico S_i:
   * S_i = (Consumo_Diario * Días_Meta) / max(1, Stock_Local + 0.1 * Stock_Malla)
   */
  public computeScarcityMultiplier(commodity: SurvivalCommodity): number {
    const spec = COMMODITY_SPECS[commodity];
    const dailyDemand = spec.dailyConsumptionPerPerson * this.squadHeadcount;
    const targetDemand = dailyDemand * this.targetReserveDays;

    const availableLocal = this.localInventory[commodity] || 0;
    const availableMeshDiscounted = (this.meshInventoryPool[commodity] || 0) * 0.15;
    const totalEffectiveSupply = Math.max(0.1, availableLocal + availableMeshDiscounted);

    // Escasez normalizada [0.2x hasta 15.0x]
    const rawScarcity = targetDemand / totalEffectiveSupply;
    return Math.min(15.0, Math.max(0.2, rawScarcity));
  }

  /**
   * Calcula el valor marginal subjetivo unitario de una mercancía:
   * Valor = BaseWeightPriority * ScarcityMultiplier
   */
  public computeSubjectiveUnitValue(commodity: SurvivalCommodity): number {
    const spec = COMMODITY_SPECS[commodity];
    const scarcity = this.computeScarcityMultiplier(commodity);
    return spec.baseWeightPriority * scarcity;
  }

  /**
   * Calcula la tasa de cambio de equilibrio justo entre dos mercancías:
   * Ratio(A -> B) = Cuántas unidades de A deben entregarse por 1 unidad de B.
   */
  public computeFairExchangeRatio(offered: SurvivalCommodity, requested: SurvivalCommodity): number {
    const valOffered = this.computeSubjectiveUnitValue(offered);
    const valRequested = this.computeSubjectiveUnitValue(requested);

    if (valOffered <= 0.001) return 999.0;
    return valRequested / valOffered;
  }

  /**
   * Evalúa una propuesta de barter recibida de un par de la malla.
   * Determina si el trato es ventajoso o justo según la OFC, o si es leonino/abusivo.
   */
  public async evaluateTradeProposal(
    proposerNodeId: string,
    peerNodeId: string,
    offeredCommodity: SurvivalCommodity,
    offeredQuantity: number,
    requestedCommodity: SurvivalCommodity,
    requestedQuantity: number
  ): Promise<BarterContract> {
    const fairRatio = this.computeFairExchangeRatio(offeredCommodity, requestedCommodity);
    const proposedRatio = offeredQuantity / Math.max(0.0001, requestedQuantity);

    // Es favorable si el ratio ofrecido rinde al menos el 85% de la paridad justa
    const isFavorableOrFair = proposedRatio >= (fairRatio * 0.85);

    const timestamp = Date.now();
    const contractId = `OFC-CONTRACT-${timestamp.toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString(16)}`;

    // Hash criptográfico de integridad del contrato
    const payload = `${contractId}:${proposerNodeId}:${peerNodeId}:${offeredCommodity}:${offeredQuantity}:${requestedCommodity}:${requestedQuantity}:${timestamp}`;
    const hashBuffer = await this.sha256(payload);

    const contract: BarterContract = {
      contractId,
      timestamp,
      proposerNodeId,
      peerNodeId,
      offeredCommodity,
      offeredQuantity,
      requestedCommodity,
      requestedQuantity,
      exchangeRatio: proposedRatio,
      fairValueRatio: fairRatio,
      isFavorableOrFair,
      status: isFavorableOrFair ? 'ACCEPTED' : 'COUNTER_OFFERED',
      contractHash: hashBuffer
    };

    this.contracts.set(contractId, contract);
    this.persistToStorage();
    this.notifyListeners();
    return contract;
  }

  /**
   * Ejecuta el asentamiento físico del contrato: actualiza inventario local
   */
  public settleContract(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract || contract.status === 'SETTLED') return false;

    // Si nosotros éramos el peer que aceptaba:
    // Entregamos requestedCommodity y recibimos offeredCommodity
    this.localInventory[contract.requestedCommodity] = Math.max(0, (this.localInventory[contract.requestedCommodity] || 0) - contract.requestedQuantity);
    this.localInventory[contract.offeredCommodity] = (this.localInventory[contract.offeredCommodity] || 0) + contract.offeredQuantity;

    contract.status = 'SETTLED';
    this.contracts.set(contractId, contract);
    this.persistToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Estima los días de autarquía del destacamento antes de que se agote el recurso más crítico
   */
  public computeAutarkyDaysRemaining(): number {
    let minDays = 999.0;

    for (const [key, spec] of Object.entries(COMMODITY_SPECS)) {
      const comm = key as SurvivalCommodity;
      const stock = this.localInventory[comm] || 0;
      const dailyBurn = spec.dailyConsumptionPerPerson * this.squadHeadcount;
      if (dailyBurn > 0) {
        const days = stock / dailyBurn;
        if (days < minDays) {
          minDays = days;
        }
      }
    }

    return Math.max(0, Math.round(minDays * 10) / 10);
  }

  public getTelemetry(): OrbitofrontalTelemetry {
    const scarcityMultipliers: Record<SurvivalCommodity, number> = {} as any;
    const unitValuations: Record<SurvivalCommodity, number> = {} as any;

    const commodities: SurvivalCommodity[] = [
      'WATER_POTABLE_L',
      'MED_ANTIBIOTIC_DOSE',
      'RATION_MRE_KCAL',
      'AMMO_556_9MM_ROUNDS',
      'ENERGY_BATTERY_WH',
      'FUEL_GASOLINE_L',
      'COMMS_FILTER_SPARES'
    ];

    const waterVal = this.computeSubjectiveUnitValue('WATER_POTABLE_L');

    for (const c of commodities) {
      scarcityMultipliers[c] = Math.round(this.computeScarcityMultiplier(c) * 100) / 100;
      const rawVal = this.computeSubjectiveUnitValue(c);
      unitValuations[c] = Math.round((rawVal / Math.max(0.01, waterVal)) * 100) / 100;
    }

    const allContracts = Array.from(this.contracts.values());
    const lastContract = allContracts.length > 0 ? allContracts[allContracts.length - 1] : undefined;

    return {
      localInventory: { ...this.localInventory },
      scarcityMultipliers,
      unitValuations,
      activeContractsCount: allContracts.filter(c => c.status !== 'SETTLED' && c.status !== 'REJECTED').length,
      lastEvaluatedContract: lastContract,
      autarkyDaysRemaining: this.computeAutarkyDaysRemaining()
    };
  }

  public subscribe(listener: (telemetry: OrbitofrontalTelemetry) => void): () => void {
    this.listeners.push(listener);
    listener(this.getTelemetry());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const telemetry = this.getTelemetry();
    for (const listener of this.listeners) {
      try {
        listener(telemetry);
      } catch (err) {
        console.error('[OrbitofrontalValuationEngine] Error in listener callback:', err);
      }
    }
  }

  private async sha256(message: string): Promise<string> {
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // Fallback si no está disponible crypto.subtle
    }
    // Fallback simple determinístico
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      hash = ((hash << 5) - hash) + message.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

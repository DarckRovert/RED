/**
 * LoRaTdmaSchedulerEngine.ts — RED Sovereign Mesh OS
 * 
 * Planificador TDMA Ranurado Estricto para Radiofrecuencia LoRa (Semtech SX1262 / Meshtastic).
 * 
 * Erradica el colapso por saturación del canal ALOHA en concentraciones masivas de nodos
 * sincronizando las transmisiones de radio en ranuras de tiempo deterministas de 200ms
 * alineadas al reloj consensuado de Lamport (LamportMeshClockEngine) y GNSS.
 * 
 * Estructura del Superframe (2000 ms total / 10 ranuras):
 * - Slot 0 (0-200ms):    Baliza de Sincronización y Latido de Malla (Beacon Sync).
 * - Slot 1-8 (200-1800ms): Ranuras de Datos Deterministas asignadas por Hash(NodeID, FrameEpoch).
 * - Slot 9 (1800-2000ms): Ranura de Contención CSMA/CA & Acceso Rápido SOS de Emergencia.
 */

import { LamportMeshClockEngine, ClockSyncQuality } from './LamportMeshClockEngine';

export interface TdmaSlotInfo {
    currentFrameEpoch: number;
    currentSlotIndex: number;
    slotTimeRemainingMs: number;
    assignedSlotIndex: number;
    isMySlotActive: boolean;
    isEmergencySlotActive: boolean;
    guardTimeMs: number;
    syncQuality: 'HIGH' | 'DEGRADED' | 'DRIFTING';
    driftPpm: number;
}

export interface TdmaQueueItem {
    id: string;
    payload: Uint8Array;
    priority: number;
    isEmergency: boolean;
    enqueuedAt: number;
    targetSlot: number;
    resolve: (ok: boolean) => void;
}

export interface TdmaSchedulerMetrics {
    packetsScheduled: number;
    packetsTransmittedOnSlot: number;
    emergencyBypasses: number;
    collisionsMitigated: number;
    averageWaitTimeMs: number;
    activeQueueLength: number;
}

export class LoRaTdmaSchedulerEngine {
    private static instance: LoRaTdmaSchedulerEngine | null = null;

    public static readonly FRAME_DURATION_MS = 2000;
    public static readonly TOTAL_SLOTS = 10;
    public static readonly SLOT_DURATION_MS = 200; // 2000 / 10 = 200 ms por ranura

    private nodeId: string = 'ANON_NODE';
    private queue: TdmaQueueItem[] = [];
    private isProcessing: boolean = false;
    private transmitHandler: ((payload: Uint8Array) => Promise<boolean>) | null = null;
    private timerHandle: any = null;

    private isTorporThrottled: boolean = false;
    private lastTorporTxTimestamp: number = 0;
    public static readonly TORPOR_MIN_TX_INTERVAL_MS = 15_000; // Mínimo 15 segundos entre transmisiones no vitales en Torpor

    private metrics: TdmaSchedulerMetrics = {
        packetsScheduled: 0,
        packetsTransmittedOnSlot: 0,
        emergencyBypasses: 0,
        collisionsMitigated: 0,
        averageWaitTimeMs: 0,
        activeQueueLength: 0,
    };

    private constructor() {
        this.scheduleNextSlotTick();
    }

    public static getInstance(): LoRaTdmaSchedulerEngine {
        if (!this.instance) {
            this.instance = new LoRaTdmaSchedulerEngine();
        }
        return this.instance;
    }

    public setNodeId(id: string): void {
        if (id && id.trim().length > 0) {
            this.nodeId = id.trim();
        }
    }

    public setTransmitHandler(handler: (payload: Uint8Array) => Promise<boolean>): void {
        this.transmitHandler = handler;
    }

    /**
     * Activa o desactiva la limitación de ciclo de trabajo por Torpor Metabólico.
     */
    public setTorporThrottle(enabled: boolean): void {
        this.isTorporThrottled = enabled;
        console.log(`[LoRaTDMA] ⚡ Torpor duty-cycle throttle ${enabled ? 'ACTIVATED (15s spacing / SOS only)' : 'DEACTIVATED (Nominal TDMA)'}`);
    }

    public getIsTorporThrottled(): boolean {
        return this.isTorporThrottled;
    }


    /**
     * Calcula determinísticamente la ranura de datos (1..8) asignada para este nodo en la época actual.
     * Utiliza un hash FNV-1a de 32 bits para distribuir equitativamente los nodos en el tiempo.
     */
    public computeAssignedSlot(frameEpoch: number): number {
        let hash = 2166136261;
        const input = `${this.nodeId}:${frameEpoch}`;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        // Ranuras 1 a 8 reservadas para datos coordinados
        return (Math.abs(hash) % 8) + 1;
    }

    /**
     * Retorna el estado actual de la sincronización de ranuras TDMA
     */
    public getCurrentSlotInfo(): TdmaSlotInfo {
        const clock = LamportMeshClockEngine.getInstance();
        const consensusTime = clock.getConsensusTime();
        const syncQuality = clock.getSyncQuality();
        const guardTimeMs = syncQuality.recommendedGuardTimeMs;

        const frameEpoch = Math.floor(consensusTime / LoRaTdmaSchedulerEngine.FRAME_DURATION_MS);
        const timeInFrame = consensusTime % LoRaTdmaSchedulerEngine.FRAME_DURATION_MS;
        const currentSlotIndex = Math.floor(timeInFrame / LoRaTdmaSchedulerEngine.SLOT_DURATION_MS);
        const slotTimeRemainingMs = LoRaTdmaSchedulerEngine.SLOT_DURATION_MS - (timeInFrame % LoRaTdmaSchedulerEngine.SLOT_DURATION_MS);
        const assignedSlot = this.computeAssignedSlot(frameEpoch);

        // La ranura propia solo se declara activa si el tiempo restante excede el tiempo de guarda
        // adaptativo calculado por el PLL para evitar desbordar hacia la ranura del siguiente nodo
        const isMySlotActive = (currentSlotIndex === assignedSlot) && (slotTimeRemainingMs > guardTimeMs);

        return {
            currentFrameEpoch: frameEpoch,
            currentSlotIndex,
            slotTimeRemainingMs,
            assignedSlotIndex: assignedSlot,
            isMySlotActive,
            isEmergencySlotActive: currentSlotIndex === 9,
            guardTimeMs,
            syncQuality: syncQuality.level,
            driftPpm: syncQuality.estimatedDriftPpm,
        };
    }

    /**
     * Generador seguro de identificadores con entropía criptográfica (CSPRNG)
     */
    private generateNonce(): string {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const buf = new Uint8Array(4);
                crypto.getRandomValues(buf);
                return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch {}
        const perf = typeof performance !== 'undefined' ? performance.now() : 0;
        return ((Date.now() ^ (perf * 1000)) & 0xffffff).toString(16).padStart(6, '0');
    }

    /**
     * Calcula los milisegundos restantes hasta la próxima ranura asignada para transmitir
     */
    public getMsUntilNextSlot(targetSlot: number): number {
        const consensusTime = LamportMeshClockEngine.getInstance().getConsensusTime();
        const timeInFrame = consensusTime % LoRaTdmaSchedulerEngine.FRAME_DURATION_MS;
        const targetSlotStartMs = targetSlot * LoRaTdmaSchedulerEngine.SLOT_DURATION_MS;

        if (timeInFrame < targetSlotStartMs) {
            return targetSlotStartMs - timeInFrame;
        } else {
            // La ranura ya pasó en este frame; calcular espera hasta el siguiente frame
            return (LoRaTdmaSchedulerEngine.FRAME_DURATION_MS - timeInFrame) + targetSlotStartMs;
        }
    }

    /**
     * Encola un paquete para ser transmitido en la ranura TDMA correspondiente.
     * Si es una emergencia SOS crítica, utiliza la ranura de contención inmediata (Slot 9) o bypass directo.
     */
    public async scheduleTransmission(
        payload: Uint8Array,
        priority: number = 5,
        isEmergency: boolean = false
    ): Promise<boolean> {
        this.metrics.packetsScheduled++;

        // CASO SOS DE EMERGENCIA CRÍTICA: Bypass directo sin esperar para salvar vidas
        if (isEmergency && priority >= 9) {
            this.metrics.emergencyBypasses++;
            if (this.transmitHandler) {
                console.log('[LoRaTDMA] 🚨 SOS Inmediato: Transmitiendo con bypass de contención');
                return await this.transmitHandler(payload);
            }
            return false;
        }

        // RESTRICCIÓN DE TORPOR METABÓLICO: En inanición energética, reprimir paquetes de baja prioridad
        if (this.isTorporThrottled && !isEmergency && priority < 8) {
            const now = Date.now();
            if (now - this.lastTorporTxTimestamp < LoRaTdmaSchedulerEngine.TORPOR_MIN_TX_INTERVAL_MS) {
                console.log('[LoRaTDMA] 🛑 Paquete no crítico suprimido por Gobernador Metabólico (Régimen TORPOR)');
                return false;
            }
            this.lastTorporTxTimestamp = now;
        }

        return new Promise<boolean>((resolve) => {
            const slotInfo = this.getCurrentSlotInfo();
            // Emergencias moderadas usan el slot 9 (contención rápida); tráfico estándar usa la ranura asignada 1..8
            const targetSlot = isEmergency ? 9 : slotInfo.assignedSlotIndex;

            const item: TdmaQueueItem = {
                id: `TDMA-${Date.now()}-${this.generateNonce()}`,
                payload,
                priority,
                isEmergency,
                enqueuedAt: Date.now(),
                targetSlot,
                resolve,
            };

            this.queue.push(item);
            this.metrics.activeQueueLength = this.queue.length;

            // Ordenar cola por prioridad descendente
            this.queue.sort((a, b) => b.priority - a.priority);
        });
    }

    private scheduleNextSlotTick(): void {
        if (this.timerHandle) clearTimeout(this.timerHandle);

        const slotInfo = this.getCurrentSlotInfo();
        // Sincronizar tick al borde exacto de la siguiente ranura (con margen de 2ms para evitar adelanto)
        const delay = Math.max(5, slotInfo.slotTimeRemainingMs + 2);

        this.timerHandle = setTimeout(() => {
            this.onSlotBoundary();
            this.scheduleNextSlotTick();
        }, delay);
    }

    /**
     * Se ejecuta en cada transición de ranura temporal (cada 200 ms)
     */
    private async onSlotBoundary(): Promise<void> {
        if (this.queue.length === 0 || this.isProcessing) return;

        const slotInfo = this.getCurrentSlotInfo();
        const currentSlot = slotInfo.currentSlotIndex;

        // Si el tiempo restante de la ranura es menor o igual al tiempo de guarda dinámico
        // y no es la ranura SOS de contención de emergencia, abortar el despacho para evitar colisiones
        if (slotInfo.slotTimeRemainingMs <= slotInfo.guardTimeMs && currentSlot !== 9) {
            return;
        }

        // En TDMA estricto: ranuras de datos (1..8) SOLO transmiten si están activamente asignadas a este nodo.
        // La ranura 0 está reservada para sincronización/beacon. La ranura 9 es contención para emergencias.
        if (currentSlot !== 9 && !slotInfo.isMySlotActive) {
            return;
        }

        // Seleccionar paquete para la ranura activa:
        // - En Slot 9: Exclusivamente paquetes de emergencia (isEmergency === true)
        // - En Ranura de datos asignada (1..8): El paquete con mayor prioridad en la cola (la cola se mantiene ordenada)
        const itemIdx = currentSlot === 9
            ? this.queue.findIndex(it => it.isEmergency)
            : 0;

        if (itemIdx === -1 || itemIdx >= this.queue.length) return;

        const item = this.queue.splice(itemIdx, 1)[0];
        this.metrics.activeQueueLength = this.queue.length;
        this.isProcessing = true;

        const waitTime = Date.now() - item.enqueuedAt;
        this.metrics.averageWaitTimeMs = Math.round((this.metrics.averageWaitTimeMs * 0.9) + (waitTime * 0.1));

        try {
            if (this.transmitHandler) {
                const ok = await this.transmitHandler(item.payload);
                this.metrics.packetsTransmittedOnSlot++;
                this.metrics.collisionsMitigated++;
                item.resolve(ok);
            } else {
                item.resolve(false);
            }
        } catch {
            item.resolve(false);
        } finally {
            this.isProcessing = false;
        }
    }

    public getMetrics(): TdmaSchedulerMetrics {
        return { ...this.metrics, activeQueueLength: this.queue.length };
    }

    public destroy(): void {
        if (this.timerHandle) clearTimeout(this.timerHandle);
        this.queue.forEach(q => q.resolve(false));
        this.queue = [];
    }
}

export const loraTdmaScheduler = LoRaTdmaSchedulerEngine.getInstance();

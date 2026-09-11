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

import { LamportMeshClockEngine } from './LamportMeshClockEngine';

export interface TdmaSlotInfo {
    currentFrameEpoch: number;
    currentSlotIndex: number;
    slotTimeRemainingMs: number;
    assignedSlotIndex: number;
    isMySlotActive: boolean;
    isEmergencySlotActive: boolean;
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
        const consensusTime = LamportMeshClockEngine.getInstance().getConsensusTime();
        const frameEpoch = Math.floor(consensusTime / LoRaTdmaSchedulerEngine.FRAME_DURATION_MS);
        const timeInFrame = consensusTime % LoRaTdmaSchedulerEngine.FRAME_DURATION_MS;
        const currentSlotIndex = Math.floor(timeInFrame / LoRaTdmaSchedulerEngine.SLOT_DURATION_MS);
        const slotTimeRemainingMs = LoRaTdmaSchedulerEngine.SLOT_DURATION_MS - (timeInFrame % LoRaTdmaSchedulerEngine.SLOT_DURATION_MS);
        const assignedSlot = this.computeAssignedSlot(frameEpoch);

        return {
            currentFrameEpoch: frameEpoch,
            currentSlotIndex,
            slotTimeRemainingMs,
            assignedSlotIndex: assignedSlot,
            isMySlotActive: currentSlotIndex === assignedSlot,
            isEmergencySlotActive: currentSlotIndex === 9,
        };
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

        return new Promise<boolean>((resolve) => {
            const slotInfo = this.getCurrentSlotInfo();
            // Emergencias moderadas usan el slot 9 (contención rápida); tráfico estándar usa la ranura asignada 1..8
            const targetSlot = isEmergency ? 9 : slotInfo.assignedSlotIndex;

            const item: TdmaQueueItem = {
                id: `TDMA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

        // Buscar un paquete destinado a la ranura activa actual
        const itemIdx = this.queue.findIndex(it => it.targetSlot === currentSlot || (currentSlot === 9 && it.isEmergency));
        if (itemIdx === -1) return;

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

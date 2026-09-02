/**
 * ZeroFootprintAiMemoryManager.ts — RED Sovereign Mesh OS
 *
 * Gestor de Memoria IA Zero-Footprint para Dispositivos de 2-3 GB de RAM.
 * Previene el cierre forzoso por OOM (Out-of-Memory) en terminales de rescate mediante:
 * 1. Temporizador de liberación estricto: descarga los pipelines ONNX/Whisper tras 15s de inactividad.
 * 2. Guardián de presión de Heap: purga inmediata si el uso de memoria JS supera el 72% del límite.
 * 3. Ejecución de recolección de basura preventiva (window.gc / cache purge).
 */

import { LocalAIEngine } from './localAiEngine';

export interface AiMemoryMetrics {
    isPipelineLoaded: boolean;
    idleTimeSec: number;
    totalPurgesCount: number;
    usedHeapMb: number;
    heapLimitMb: number;
    heapPressurePct: number;
    isHighPressure: boolean;
}

export class ZeroFootprintAiMemoryManager {
    private static instance: ZeroFootprintAiMemoryManager;

    private lastActivityTime = Date.now();
    private isPipelineActive = false;
    private idleTimer: any = null;
    private checkIntervalTimer: any = null;
    private totalPurgesCount = 0;
    private readonly IDLE_TIMEOUT_MS = 15000; // 15 segundos

    private listeners: Set<(metrics: AiMemoryMetrics) => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.checkIntervalTimer = setInterval(() => this.checkMemoryHealth(), 5000);
        }
    }

    public static getInstance(): ZeroFootprintAiMemoryManager {
        if (!ZeroFootprintAiMemoryManager.instance) {
            ZeroFootprintAiMemoryManager.instance = new ZeroFootprintAiMemoryManager();
        }
        return ZeroFootprintAiMemoryManager.instance;
    }

    /** Registra el inicio de una inferencia neuronal */
    public notifyInferenceStart(): void {
        this.lastActivityTime = Date.now();
        this.isPipelineActive = true;
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        this.notify();
    }

    /** Registra la finalización de una inferencia y programa la purga */
    public notifyInferenceEnd(): void {
        this.lastActivityTime = Date.now();
        this.isPipelineActive = false;

        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.purgeAiPipelines('idle_timeout');
        }, this.IDLE_TIMEOUT_MS);

        this.notify();
    }

    /** Purga inmediatamente los modelos de la memoria RAM */
    public purgeAiPipelines(reason = 'manual'): void {
        try {
            LocalAIEngine.disposePipelines();
            this.totalPurgesCount++;
            this.isPipelineActive = false;
            if (this.idleTimer) {
                clearTimeout(this.idleTimer);
                this.idleTimer = null;
            }
            if (typeof window !== 'undefined' && (window as any).gc) {
                try { (window as any).gc(); } catch {}
            }
            console.log(`[ZeroFootprintAi] 🧹 Modelos IA purgados de RAM (${reason}). Total purgas: ${this.totalPurgesCount}`);
        } catch (err) {
            console.warn('[ZeroFootprintAi] Error purgando pipelines:', err);
        }
        this.notify();
    }

    /** Verifica la presión del Heap de JavaScript */
    private checkMemoryHealth(): void {
        if (typeof window === 'undefined') return;

        const perf: any = window.performance;
        if (perf?.memory) {
            const used = perf.memory.usedJSHeapSize || 0;
            const total = perf.memory.jsHeapSizeLimit || 1;
            const ratio = used / total;

            // Si la memoria supera el 72% de la cuota y no hay inferencia activa, purgar de inmediato
            if (ratio > 0.72 && !this.isPipelineActive) {
                this.purgeAiPipelines('heap_pressure_guard');
            }
        }

        this.notify();
    }

    /** Retorna las métricas actuales de memoria */
    public getMetrics(): AiMemoryMetrics {
        let usedMb = 0;
        let limitMb = 0;
        let pressurePct = 0;

        if (typeof window !== 'undefined') {
            const perf: any = window.performance;
            if (perf?.memory) {
                usedMb = Math.round((perf.memory.usedJSHeapSize || 0) / (1024 * 1024));
                limitMb = Math.round((perf.memory.jsHeapSizeLimit || 1) / (1024 * 1024));
                pressurePct = Math.round((usedMb / (limitMb || 1)) * 100);
            }
        }

        const idleSec = Math.round((Date.now() - this.lastActivityTime) / 1000);

        return {
            isPipelineLoaded: this.isPipelineActive,
            idleTimeSec: idleSec,
            totalPurgesCount: this.totalPurgesCount,
            usedHeapMb: usedMb,
            heapLimitMb: limitMb,
            heapPressurePct: pressurePct,
            isHighPressure: pressurePct > 70,
        };
    }

    public subscribe(listener: (metrics: AiMemoryMetrics) => void): () => void {
        this.listeners.add(listener);
        listener(this.getMetrics());
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const m = this.getMetrics();
        this.listeners.forEach(cb => {
            try { cb(m); } catch {}
        });
    }
}

export const zeroFootprintAiMemoryManager = ZeroFootprintAiMemoryManager.getInstance();

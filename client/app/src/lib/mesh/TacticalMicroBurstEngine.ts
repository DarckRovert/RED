/**
 * TacticalMicroBurstEngine.ts — RED Low-Probability-of-Intercept / Detection (LPI/LPD) Micro-Burst Engine
 * 
 * Aggregates outbound mesh traffic and transmits compressed data in high-speed, sub-15ms bursts
 * with pseudo-randomized silence intervals to defeat SIGINT direction finding and RF spectral analysis.
 */

export interface MicroBurstRecord {
    id: string;
    timestamp: number;
    payloadLengthBytes: number;
    burstDurationMs: number;
    silenceJitterMs: number;
    status: 'QUEUED' | 'TRANSMITTED';
}

export interface MicroBurstTelemetry {
    isLpiModeActive: boolean;
    queuedPacketsCount: number;
    totalBurstsTransmitted: number;
    lastBurstDurationMs: number;
    nextBurstInSeconds: number;
    history: MicroBurstRecord[];
}

export class TacticalMicroBurstEngine {
    private static instance: TacticalMicroBurstEngine | null = null;

    private isLpiModeActive: boolean = true;
    private packetQueue: string[] = [];
    private history: MicroBurstRecord[] = [];
    private totalBursts: number = 0;
    private lastBurstDurationMs: number = 11;
    private nextBurstTimeout: any = null;
    private nextBurstTimestamp: number = Date.now() + 12000;

    private listeners: Set<(t: MicroBurstTelemetry) => void> = new Set();

    private constructor() {
        this.scheduleNextBurst();
    }

    public static getInstance(): TacticalMicroBurstEngine {
        if (!this.instance) {
            this.instance = new TacticalMicroBurstEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: MicroBurstTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.getTelemetry());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const telemetry = this.getTelemetry();
        this.listeners.forEach(cb => {
            try { cb(telemetry); } catch {}
        });
    }

    public getTelemetry(): MicroBurstTelemetry {
        const now = Date.now();
        const nextSec = Math.max(0, Math.round((this.nextBurstTimestamp - now) / 1000));

        return {
            isLpiModeActive: this.isLpiModeActive,
            queuedPacketsCount: this.packetQueue.length,
            totalBurstsTransmitted: this.totalBursts,
            lastBurstDurationMs: this.lastBurstDurationMs,
            nextBurstInSeconds: nextSec,
            history: [...this.history].slice(0, 10),
        };
    }

    public setLpiMode(enabled: boolean) {
        this.isLpiModeActive = enabled;
        this.notify();
    }

    /**
     * Encola un payload para ser transmitido en la próxima micro-ráfaga silenciosa
     */
    public enqueuePayload(payload: string): string {
        const packetId = `BURST-PKT-${Date.now().toString(36)}`;
        this.packetQueue.push(payload);
        this.notify();
        return packetId;
    }

    private scheduleNextBurst() {
        if (this.nextBurstTimeout) clearTimeout(this.nextBurstTimeout);

        // Dispersión temporal aleatoria entre 6s y 25s
        const randomSilenceMs = Math.floor(6000 + Math.random() * 19000);
        this.nextBurstTimestamp = Date.now() + randomSilenceMs;

        this.nextBurstTimeout = setTimeout(() => {
            this.executeBurst();
        }, randomSilenceMs);
    }

    /**
     * Ejecuta la micro-ráfaga ultracorta comprimida
     */
    public executeBurst() {
        if (this.packetQueue.length === 0) {
            this.scheduleNextBurst();
            return;
        }

        const totalPayload = this.packetQueue.join('||');
        const byteLen = new TextEncoder().encode(totalPayload).length;
        // Simular duración de ráfaga física de alta tasa (sub-15ms)
        const burstDurationMs = Math.max(4, Math.min(14, Math.round(byteLen * 0.02)));

        this.lastBurstDurationMs = burstDurationMs;
        this.totalBursts++;

        const record: MicroBurstRecord = {
            id: `BURST-${Date.now()}`,
            timestamp: Date.now(),
            payloadLengthBytes: byteLen,
            burstDurationMs,
            silenceJitterMs: Math.round(this.nextBurstTimestamp - Date.now()),
            status: 'TRANSMITTED',
        };

        this.history.unshift(record);
        if (this.history.length > 20) this.history.pop();

        this.packetQueue = [];
        this.scheduleNextBurst();
        this.notify();
    }
}

export const tacticalMicroBurst = TacticalMicroBurstEngine.getInstance();

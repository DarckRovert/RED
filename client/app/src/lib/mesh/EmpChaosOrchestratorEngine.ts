/**
 * EmpChaosOrchestratorEngine.ts — RED Tactical Electromagnetic Pulse (EMP) & Chaos Mesh Stress Orchestrator
 * 
 * Simulates military-grade electronic warfare, high-altitude electromagnetic pulse (HEMP) isolation,
 * white Gaussian noise injection, and multi-node mesh network partitions to validate survival resilience.
 */

import { dynamicBearerGovernor } from './DynamicBearerGovernor';
import { globalShield } from '../network/GlobalShieldEngine';

export type ChaosScenario = 'EMP_SIMULATION' | 'RF_JAMMING_FLOOD' | 'MESH_PARTITION' | 'DURESS_PANIC_STRESS' | 'CLEAR';

export interface ChaosEngineState {
    activeScenario: ChaosScenario;
    isInjectingErrors: boolean;
    packetDropRatePct: number;
    injectedNoiseSnrDb: number;
    faradayIsolationEnabled: boolean;
    elapsedDrillSeconds: number;
}

export class EmpChaosOrchestratorEngine {
    private static instance: EmpChaosOrchestratorEngine | null = null;

    private activeScenario: ChaosScenario = 'CLEAR';
    private isInjectingErrors: boolean = false;
    private packetDropRatePct: number = 0;
    private injectedNoiseSnrDb: number = 0;
    private faradayIsolationEnabled: boolean = false;
    private elapsedDrillSeconds: number = 0;
    private timer: any = null;

    private listeners: Set<(s: ChaosEngineState) => void> = new Set();

    private constructor() {}

    public static getInstance(): EmpChaosOrchestratorEngine {
        if (!this.instance) {
            this.instance = new EmpChaosOrchestratorEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (s: ChaosEngineState) => void): () => void {
        this.listeners.add(cb);
        cb(this.getState());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const s = this.getState();
        this.listeners.forEach(cb => {
            try { cb(s); } catch {}
        });
    }

    public startScenario(scenario: ChaosScenario) {
        this.stopScenario();
        this.activeScenario = scenario;
        this.isInjectingErrors = true;
        this.elapsedDrillSeconds = 0;

        if (scenario === 'EMP_SIMULATION') {
            this.faradayIsolationEnabled = true;
            this.packetDropRatePct = 100;
            this.injectedNoiseSnrDb = -45;
            globalShield.setDefcon(1); // MÁXIMO AISLAMIENTO
        } else if (scenario === 'RF_JAMMING_FLOOD') {
            this.faradayIsolationEnabled = false;
            this.packetDropRatePct = 75;
            this.injectedNoiseSnrDb = -20;
            dynamicBearerGovernor.forceSwitchBearer('LORA_RF'); // Conmutación anti-jamming
        } else if (scenario === 'MESH_PARTITION') {
            this.faradayIsolationEnabled = false;
            this.packetDropRatePct = 50;
            this.injectedNoiseSnrDb = -10;
        }

        this.timer = setInterval(() => {
            this.elapsedDrillSeconds++;
            // Inyectar telemetría de estrés continuo
            if (this.packetDropRatePct > 0) {
                dynamicBearerGovernor.recordPacketDelivery('WIFI_DIRECT', false, 999);
            }
            this.notify();
        }, 1000);

        this.notify();
    }

    public stopScenario() {
        this.activeScenario = 'CLEAR';
        this.isInjectingErrors = false;
        this.packetDropRatePct = 0;
        this.injectedNoiseSnrDb = 0;
        this.faradayIsolationEnabled = false;
        this.elapsedDrillSeconds = 0;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.notify();
    }

    public getState(): ChaosEngineState {
        return {
            activeScenario: this.activeScenario,
            isInjectingErrors: this.isInjectingErrors,
            packetDropRatePct: this.packetDropRatePct,
            injectedNoiseSnrDb: this.injectedNoiseSnrDb,
            faradayIsolationEnabled: this.faradayIsolationEnabled,
            elapsedDrillSeconds: this.elapsedDrillSeconds,
        };
    }
}

export const empChaosOrchestrator = EmpChaosOrchestratorEngine.getInstance();

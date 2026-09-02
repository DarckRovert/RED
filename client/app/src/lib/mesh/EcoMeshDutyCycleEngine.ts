/**
 * EcoMeshDutyCycleEngine.ts — RED Sovereign Mesh OS
 *
 * Motor de Gestión Energética Adaptativa y Ciclos de Trabajo (Duty-Cycling).
 * Extiende la duración de la batería de 6 a 36-48 horas mediante:
 * 1. Monitoreo inercial por acelerómetro: detecta reposo vs movimiento del operador.
 * 2. Adaptación por umbral de batería: Aggressive -> Balanced -> Ultra-Eco.
 * 3. Anulación prioritaria (SOS / Tráfico entrante): despierta al 100% de inmediato.
 */

export type DutyCycleMode = 'aggressive' | 'balanced' | 'ultra_eco' | 'sos_override';

export interface DutyCycleConfig {
    scanDurationMs: number;
    sleepDurationMs: number;
    description: string;
}

export interface EcoMeshState {
    mode: DutyCycleMode;
    isScanning: boolean;
    batteryLevel: number; // 0 - 100
    isCharging: boolean;
    isStationary: boolean;
    stationaryDurationSec: number;
    estimatedBatteryLifeHours: number;
    activeDutyCyclePct: number;
}

export class EcoMeshDutyCycleEngine {
    private static instance: EcoMeshDutyCycleEngine;

    private mode: DutyCycleMode = 'balanced';
    private isScanning = true;
    private batteryLevel = 100;
    private isCharging = false;
    private isStationary = false;
    private lastMotionTime = Date.now();
    private activeTimer: any = null;
    private cycleTimer: any = null;
    private motionListenerActive = false;

    private listeners: Set<(state: EcoMeshState) => void> = new Set();
    private scanStateListeners: Set<(shouldScan: boolean) => void> = new Set();

    private readonly CONFIGS: Record<DutyCycleMode, DutyCycleConfig> = {
        aggressive: { scanDurationMs: 10000, sleepDurationMs: 0, description: '100% Escaneo Continuo (Operaciones Activas)' },
        balanced: { scanDurationMs: 5000, sleepDurationMs: 15000, description: '25% Ciclo (5s Activo / 15s Reposo) — 24h Duración' },
        ultra_eco: { scanDurationMs: 3000, sleepDurationMs: 30000, description: '9% Ciclo (3s Activo / 30s Reposo) — 48h Duración' },
        sos_override: { scanDurationMs: 15000, sleepDurationMs: 0, description: '100% Alerta de Emergencia / Rescate' },
    };

    private constructor() {
        this.initBatteryMonitoring();
        this.initMotionDetection();
        this.startCycleLoop();
    }

    public static getInstance(): EcoMeshDutyCycleEngine {
        if (!EcoMeshDutyCycleEngine.instance) {
            EcoMeshDutyCycleEngine.instance = new EcoMeshDutyCycleEngine();
        }
        return EcoMeshDutyCycleEngine.instance;
    }

    /** Inicializa la lectura de batería desde Capacitor o Web API */
    private async initBatteryMonitoring(): Promise<void> {
        try {
            const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
            if (cap?.Plugins?.Device) {
                const info = await cap.Plugins.Device.getBatteryInfo();
                if (typeof info.batteryLevel === 'number') {
                    this.batteryLevel = Math.round(info.batteryLevel * 100);
                    this.isCharging = !!info.isCharging;
                }
            } else if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
                const batt: any = await (navigator as any).getBattery();
                this.batteryLevel = Math.round((batt.level ?? 1) * 100);
                this.isCharging = !!batt.charging;
                batt.addEventListener('levelchange', () => {
                    this.batteryLevel = Math.round((batt.level ?? 1) * 100);
                    this.evaluatePolicy();
                });
                batt.addEventListener('chargingchange', () => {
                    this.isCharging = !!batt.charging;
                    this.evaluatePolicy();
                });
            }
        } catch {}
        this.evaluatePolicy();
    }

    /** Inicializa la detección inercial de reposo / movimiento */
    private initMotionDetection(): void {
        if (typeof window === 'undefined' || !window.addEventListener || this.motionListenerActive) return;
        try {
            let lastX = 0, lastY = 0, lastZ = 0;
            window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
                const acc = event.accelerationIncludingGravity || event.acceleration;
                if (!acc) return;
                const x = acc.x || 0;
                const y = acc.y || 0;
                const z = acc.z || 0;
                const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
                lastX = x; lastY = y; lastZ = z;

                if (delta > 1.2) {
                    this.lastMotionTime = Date.now();
                    if (this.isStationary) {
                        this.isStationary = false;
                        this.evaluatePolicy();
                    }
                }
            }, { passive: true });
            this.motionListenerActive = true;
        } catch {}
    }

    /** Evalúa y ajusta automáticamente la política energética */
    public evaluatePolicy(): void {
        if (this.mode === 'sos_override') return;

        const idleDurationSec = (Date.now() - this.lastMotionTime) / 1000;
        this.isStationary = idleDurationSec > 180; // 3 minutos sin movimiento

        if (this.isCharging) {
            this.setMode('aggressive');
            return;
        }

        if (this.batteryLevel <= 15) {
            this.setMode('ultra_eco');
        } else if (this.batteryLevel <= 40 || this.isStationary) {
            this.setMode(idleDurationSec > 600 ? 'ultra_eco' : 'balanced');
        } else {
            this.setMode('balanced');
        }
    }

    /** Fija manualmente o por anulación el modo de trabajo */
    public setMode(newMode: DutyCycleMode): void {
        if (this.mode === newMode) return;
        this.mode = newMode;
        this.startCycleLoop();
        this.notifyState();
    }

    /** Anulación de emergencia inmediata ante alerta SOS o paquete crítico */
    public triggerEmergencyOverride(durationMs = 60000): void {
        this.setMode('sos_override');
        if (this.activeTimer) clearTimeout(this.activeTimer);
        this.activeTimer = setTimeout(() => {
            this.mode = 'balanced';
            this.evaluatePolicy();
        }, durationMs);
    }

    /** Ciclo de trabajo periódico (Scan / Sleep) */
    private startCycleLoop(): void {
        if (this.cycleTimer) clearTimeout(this.cycleTimer);

        const config = this.CONFIGS[this.mode];
        if (config.sleepDurationMs === 0) {
            // Escaneo 100% continuo
            this.isScanning = true;
            this.notifyScanState(true);
            return;
        }

        const runCycle = () => {
            // Fase de Escaneo
            this.isScanning = true;
            this.notifyScanState(true);

            this.cycleTimer = setTimeout(() => {
                // Fase de Reposo
                this.isScanning = false;
                this.notifyScanState(false);

                this.cycleTimer = setTimeout(() => {
                    runCycle();
                }, config.sleepDurationMs);
            }, config.scanDurationMs);
        };

        runCycle();
    }

    /** Retorna el estado actual del motor energético */
    public getState(): EcoMeshState {
        const config = this.CONFIGS[this.mode];
        const totalTime = config.scanDurationMs + config.sleepDurationMs;
        const activePct = totalTime > 0 ? Math.round((config.scanDurationMs / totalTime) * 100) : 100;
        const stationarySec = Math.round((Date.now() - this.lastMotionTime) / 1000);

        // Estimación de duración de batería
        const baseDrainPerHour = activePct === 100 ? 12 : activePct >= 25 ? 3.8 : 1.9;
        const estimatedHours = Math.max(1, Math.round(this.batteryLevel / baseDrainPerHour));

        return {
            mode: this.mode,
            isScanning: this.isScanning,
            batteryLevel: this.batteryLevel,
            isCharging: this.isCharging,
            isStationary: this.isStationary,
            stationaryDurationSec: stationarySec,
            estimatedBatteryLifeHours: estimatedHours,
            activeDutyCyclePct: activePct,
        };
    }

    public subscribe(listener: (state: EcoMeshState) => void): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }

    public onScanStateChange(listener: (shouldScan: boolean) => void): () => void {
        this.scanStateListeners.add(listener);
        listener(this.isScanning);
        return () => this.scanStateListeners.delete(listener);
    }

    private notifyState(): void {
        const st = this.getState();
        this.listeners.forEach(cb => {
            try { cb(st); } catch {}
        });
    }

    private notifyScanState(scanning: boolean): void {
        this.scanStateListeners.forEach(cb => {
            try { cb(scanning); } catch {}
        });
        this.notifyState();
    }
}

export const ecoMeshDutyCycleEngine = EcoMeshDutyCycleEngine.getInstance();

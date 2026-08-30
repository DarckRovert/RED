/**
 * KineticDutyGovernor.ts — RED Sensor-Aware Dynamic Battery & RF Duty Cycling Engine
 * 
 * Analyzes real-time accelerometer energy variance and hardware battery metrics
 * to automatically throttle or boost BLE/Wi-Fi mesh scanning and LoRa transmit power,
 * maximizing battery autonomy (up to 36-48 hours in blackout survival mode).
 */

export type DutyCycleProfile = "SURVIVAL_SENTRY" | "BALANCED_PATROL" | "HIGH_PERFORMANCE" | "SHAKE_BOOST";

export interface KineticTelemetry {
    batteryLevel: number; // 0 - 100
    isCharging: boolean;
    isStationary: boolean;
    kineticEnergyScore: number; // 0 - 100
    currentProfile: DutyCycleProfile;
    bleScanIntervalMs: number;
    loraTxPowerDbm: number;
    estimatedMeshHours: number;
    lastMotionTimestamp: number;
}

export class KineticDutyGovernor {
    private static instance: KineticDutyGovernor | null = null;
    private listeners: Set<(telemetry: KineticTelemetry) => void> = new Set();

    private batteryLevel: number = 85;
    private isCharging: boolean = false;
    private isStationary: boolean = true;
    private kineticEnergyScore: number = 0;
    private lastMotionTimestamp: number = Date.now();
    private isShakeBoostActive: boolean = false;
    private shakeBoostTimer: any = null;

    // Rolling accelerometer window
    private accelReadings: number[] = [];
    private maxWindowSize: number = 10;
    private motionInterval: any = null;

    private constructor() {
        this.initSensors();
    }

    public static getInstance(): KineticDutyGovernor {
        if (!this.instance) {
            this.instance = new KineticDutyGovernor();
        }
        return this.instance;
    }

    private async initSensors() {
        if (typeof window === "undefined") return;

        // 1. Hardware Battery Listener
        try {
            if ("getBattery" in navigator) {
                const battery: any = await (navigator as any).getBattery();
                this.batteryLevel = Math.round(battery.level * 100);
                this.isCharging = !!battery.charging;

                battery.addEventListener("levelchange", () => {
                    this.batteryLevel = Math.round(battery.level * 100);
                    this.evaluateProfile();
                });
                battery.addEventListener("chargingchange", () => {
                    this.isCharging = !!battery.charging;
                    this.evaluateProfile();
                });
            }
        } catch {}

        // 2. Hardware Accelerometer Listener
        try {
            if (window.DeviceMotionEvent) {
                window.addEventListener("devicemotion", (event) => {
                    const acc = event.accelerationIncludingGravity || event.acceleration;
                    if (acc && typeof acc.x === "number" && typeof acc.y === "number" && typeof acc.z === "number") {
                        const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
                        this.recordMotionSample(mag);
                    }
                });
            }
        } catch {}

        // 3. Android Doze Mode & Background Visibility Guard
        try {
            if (typeof document !== "undefined") {
                document.addEventListener("visibilitychange", () => {
                    if (document.hidden) {
                        // Modo Fondo / Reposo -> Activar perfil Sentry con pulso periódico
                        this.evaluateProfile();
                    } else {
                        // Retorno a Primer Plano -> Despertar inmediato y ráfaga de escaneo
                        this.triggerShakeBoost();
                    }
                });
            }
        } catch {}

        // Periodic evaluation timer (every 3 seconds)
        this.motionInterval = setInterval(() => {
            this.evaluateProfile();
        }, 3000);
    }

    private recordMotionSample(magnitude: number) {
        // High pass / variance against gravity (9.8 m/s^2)
        const delta = Math.abs(magnitude - 9.80665);
        this.accelReadings.push(delta);
        if (this.accelReadings.length > this.maxWindowSize) {
            this.accelReadings.shift();
        }

        const avgDelta = this.accelReadings.reduce((a, b) => a + b, 0) / this.accelReadings.length;
        this.kineticEnergyScore = Math.min(100, Math.round(avgDelta * 20));

        // Threshold for human movement (walking / shaking)
        if (avgDelta > 1.2) {
            this.isStationary = false;
            this.lastMotionTimestamp = Date.now();
        } else if (Date.now() - this.lastMotionTimestamp > 15000) {
            // Stationary if no movement for 15 seconds
            this.isStationary = true;
        }

        // Detect Shake Burst (> 6.0 m/s^2 delta)
        if (delta > 6.0 && !this.isShakeBoostActive) {
            this.triggerShakeBoost();
        }
    }

    public triggerShakeBoost() {
        this.isShakeBoostActive = true;
        if (this.shakeBoostTimer) clearTimeout(this.shakeBoostTimer);
        this.evaluateProfile();

        // Keep high-rate boost active for 20 seconds
        this.shakeBoostTimer = setTimeout(() => {
            this.isShakeBoostActive = false;
            this.evaluateProfile();
        }, 20000);
    }

    public setManualBattery(level: number) {
        this.batteryLevel = Math.max(1, Math.min(100, level));
        this.evaluateProfile();
    }

    public setHardwareBattery(levelPercent: number, isCharging = false) {
        if (!isNaN(levelPercent) && levelPercent >= 0 && levelPercent <= 100) {
            this.batteryLevel = Math.round(levelPercent);
            this.isCharging = !!isCharging;
            this.evaluateProfile();
        }
    }

    public getTelemetry(): KineticTelemetry {
        let profile: DutyCycleProfile = "BALANCED_PATROL";
        let bleScanIntervalMs = 4000;
        let loraTxPowerDbm = 14;
        let estimatedMeshHours = 24;

        if (this.isShakeBoostActive) {
            profile = "SHAKE_BOOST";
            bleScanIntervalMs = 800;
            loraTxPowerDbm = 20;
            estimatedMeshHours = (this.batteryLevel / 100) * 12;
        } else if (this.isCharging || (this.batteryLevel > 50 && !this.isStationary)) {
            profile = "HIGH_PERFORMANCE";
            bleScanIntervalMs = 1500;
            loraTxPowerDbm = 18;
            estimatedMeshHours = (this.batteryLevel / 100) * 20;
        } else if (this.batteryLevel <= 20 || (this.batteryLevel <= 40 && this.isStationary)) {
            profile = "SURVIVAL_SENTRY";
            bleScanIntervalMs = 12000;
            loraTxPowerDbm = 10;
            estimatedMeshHours = (this.batteryLevel / 100) * 48; // Up to 48 hours
        } else {
            profile = "BALANCED_PATROL";
            bleScanIntervalMs = 4000;
            loraTxPowerDbm = 14;
            estimatedMeshHours = (this.batteryLevel / 100) * 32;
        }

        return {
            batteryLevel: this.batteryLevel,
            isCharging: this.isCharging,
            isStationary: this.isStationary,
            kineticEnergyScore: this.kineticEnergyScore,
            currentProfile: profile,
            bleScanIntervalMs,
            loraTxPowerDbm,
            estimatedMeshHours: parseFloat(estimatedMeshHours.toFixed(1)),
            lastMotionTimestamp: this.lastMotionTimestamp
        };
    }

    private lastEmittedTime: number = 0;
    private lastEmittedProfile: DutyCycleProfile = "BALANCED_PATROL";

    public subscribe(listener: (telemetry: KineticTelemetry) => void): () => void {
        this.listeners.add(listener);
        listener(this.getTelemetry());
        return () => this.listeners.delete(listener);
    }

    private evaluateProfile(force = false) {
        const telemetry = this.getTelemetry();
        const now = Date.now();
        const profileChanged = telemetry.currentProfile !== this.lastEmittedProfile;

        // Rate-limit UI React dispatches to 1Hz unless an active profile transition occurred
        if (!force && !profileChanged && now - this.lastEmittedTime < 1000) {
            return;
        }

        this.lastEmittedTime = now;
        this.lastEmittedProfile = telemetry.currentProfile;
        this.listeners.forEach(fn => {
            try { fn(telemetry); } catch (err) { console.error('[KineticDutyGovernor] Subscriber callback error:', err); }
        });
    }

    public destroy() {
        if (this.motionInterval) {
            clearInterval(this.motionInterval);
            this.motionInterval = null;
        }
        if (this.shakeBoostTimer) {
            clearTimeout(this.shakeBoostTimer);
            this.shakeBoostTimer = null;
        }
        this.listeners.clear();
    }
}

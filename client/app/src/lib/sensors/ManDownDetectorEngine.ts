/**
 * ManDownDetectorEngine.ts — RED Tactical Man-Down & Dead-Man's Switch Engine
 * 
 * Analyzes real-time device accelerometer vectors to detect free-fall/high-g impacts (> 2.5g)
 * followed by prolonged immobility (> 45s), initiating a 15-second acoustic/haptic pre-alarm
 * before automatically broadcasting a high-priority SOS distress beacon across the mesh.
 */

import { meshSosBeacon } from '../emergency/MeshSosBeaconEngine';
import { TacticalAudioEngine } from '../audio/TacticalAudioEngine';

export type ManDownState = 'DISARMED' | 'MONITORING' | 'IMPACT_DETECTED' | 'PRE_ALARM_COUNTDOWN' | 'ALARM_DISPATCHED';

export interface ManDownTelemetry {
    state: ManDownState;
    isArmed: boolean;
    secondsRemaining: number;
    lastMagnitude: number;
    immobilityDurationSec: number;
    impactTimestamp: number | null;
}

export class ManDownDetectorEngine {
    private static instance: ManDownDetectorEngine | null = null;

    private state: ManDownState = 'DISARMED';
    private isArmed: boolean = false;
    private lastMagnitude: number = 1.0; // Standard 1g gravity
    private lastMotionTime: number = Date.now();
    private impactTimestamp: number | null = null;
    private secondsRemaining: number = 15;

    private motionListener: ((e: DeviceMotionEvent) => void) | null = null;
    private checkInterval: any = null;
    private preAlarmInterval: any = null;
    private listeners: Set<(telemetry: ManDownTelemetry) => void> = new Set();

    // Thresholds
    private readonly IMPACT_G_THRESHOLD = 2.4; // Impact > 2.4g
    private readonly IMMOBILITY_WINDOW_MS = 45 * 1000; // 45s without significant motion
    private readonly PRE_ALARM_SECONDS = 15;

    private constructor() {}

    public static getInstance(): ManDownDetectorEngine {
        if (!this.instance) {
            this.instance = new ManDownDetectorEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (telemetry: ManDownTelemetry) => void): () => void {
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

    public getTelemetry(): ManDownTelemetry {
        const immobilityDurationSec = Math.floor((Date.now() - this.lastMotionTime) / 1000);
        return {
            state: this.state,
            isArmed: this.isArmed,
            secondsRemaining: this.secondsRemaining,
            lastMagnitude: Math.round(this.lastMagnitude * 100) / 100,
            immobilityDurationSec,
            impactTimestamp: this.impactTimestamp,
        };
    }

    /**
     * Activa el centinela de Hombre Caído
     */
    public armSentry(): boolean {
        if (typeof window === 'undefined') return false;

        this.isArmed = true;
        this.state = 'MONITORING';
        this.lastMotionTime = Date.now();
        this.impactTimestamp = null;
        this.secondsRemaining = this.PRE_ALARM_SECONDS;

        this.startMotionTracking();
        this.startMonitoringLoop();
        this.notify();
        return true;
    }

    /**
     * Desarma el centinela de Hombre Caído
     */
    public disarmSentry() {
        this.isArmed = false;
        this.state = 'DISARMED';
        this.stopAllTimers();
        this.notify();
    }

    /**
     * Cancela la pre-alarma si el operador se encuentra bien (falso positivo)
     */
    public cancelPreAlarm() {
        if (this.state === 'PRE_ALARM_COUNTDOWN' || this.state === 'IMPACT_DETECTED') {
            this.state = 'MONITORING';
            this.impactTimestamp = null;
            this.lastMotionTime = Date.now();
            this.secondsRemaining = this.PRE_ALARM_SECONDS;
            if (this.preAlarmInterval) clearInterval(this.preAlarmInterval);
            this.preAlarmInterval = null;
            TacticalAudioEngine.playRogerBeep();
            this.notify();
        }
    }

    private startMotionTracking() {
        if (typeof window === 'undefined') return;

        this.motionListener = (e: DeviceMotionEvent) => {
            const acc = e.accelerationIncludingGravity || e.acceleration;
            if (!acc) return;

            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 9.81;

            // Magnitud en unidades g (1g ≈ 9.81 m/s^2)
            const magnitudeMps2 = Math.sqrt(x * x + y * y + z * z);
            const magnitudeG = magnitudeMps2 / 9.81;
            this.lastMagnitude = magnitudeG;

            // Detectar micro-movimientos (> 0.15g de variación respecto a reposo)
            if (Math.abs(magnitudeG - 1.0) > 0.15) {
                this.lastMotionTime = Date.now();
            }

            // Detectar impacto severo
            if (this.state === 'MONITORING' && magnitudeG >= this.IMPACT_G_THRESHOLD) {
                this.state = 'IMPACT_DETECTED';
                this.impactTimestamp = Date.now();
                this.notify();
            }
        };

        window.addEventListener('devicemotion', this.motionListener);
    }

    private startMonitoringLoop() {
        if (this.checkInterval) clearInterval(this.checkInterval);

        this.checkInterval = setInterval(() => {
            if (!this.isArmed) return;

            const now = Date.now();

            // Si se detectó impacto y el operador permanece inmóvil durante 5 segundos
            if (this.state === 'IMPACT_DETECTED') {
                if (this.impactTimestamp && (now - this.impactTimestamp >= 5000)) {
                    this.startPreAlarmCountdown();
                }
            }

            // O si no hubo impacto pero hay inmovilidad total prolongada (> 45s) en zona hostil
            if (this.state === 'MONITORING') {
                if (now - this.lastMotionTime >= this.IMMOBILITY_WINDOW_MS) {
                    this.startPreAlarmCountdown();
                }
            }

            this.notify();
        }, 1000);
    }

    private startPreAlarmCountdown() {
        if (this.state === 'PRE_ALARM_COUNTDOWN') return;

        this.state = 'PRE_ALARM_COUNTDOWN';
        this.secondsRemaining = this.PRE_ALARM_SECONDS;
        this.notify();

        // Pitido de advertencia inicial
        TacticalAudioEngine.playEmergencyAlarm();

        if (this.preAlarmInterval) clearInterval(this.preAlarmInterval);

        this.preAlarmInterval = setInterval(() => {
            this.secondsRemaining--;

            // Pitido creciente
            TacticalAudioEngine.playTap();

            if (this.secondsRemaining <= 0) {
                clearInterval(this.preAlarmInterval);
                this.preAlarmInterval = null;
                this.dispatchEmergencySos();
            } else {
                this.notify();
            }
        }, 1000);
    }

    private async dispatchEmergencySos() {
        this.state = 'ALARM_DISPATCHED';
        this.notify();

        try {
            // Emisión automática de socorro con código de rescate TCCC
            await meshSosBeacon.activateSosBeacon({
                distressType: 'TCCC_MEDICAL',
                triageColor: 'RED',
                note: '🚨 ALERTA AUTOMÁTICA HOMBRE CAÍDO (IMPACTO / INMOVILIDAD DETECTADA)',
            }, 'MAN_DOWN_SENTRY', 'Operador Inconsciente');

            TacticalAudioEngine.playEmergencyAlarm();
        } catch (e) {
            console.error('[ManDownDetectorEngine] Fallo al emitir baliza SOS automática:', e);
        }
    }

    private stopAllTimers() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        if (this.preAlarmInterval) clearInterval(this.preAlarmInterval);
        this.checkInterval = null;
        this.preAlarmInterval = null;

        if (this.motionListener && typeof window !== 'undefined') {
            window.removeEventListener('devicemotion', this.motionListener);
            this.motionListener = null;
        }
    }
}

export const manDownDetector = ManDownDetectorEngine.getInstance();

/**
 * RED 2.0 — TacticalCompassEngine.ts
 *
 * Motor Soberano Unificado de Brújula Táctica y Orientación para Operaciones Extremas.
 *
 * Resuelve y mitiga fallos en hardware real (smartphones y tablets Android / iOS):
 * 1. Arbitraje Jerárquico en 5 Niveles:
 *    - Nivel 1: window.AbsoluteOrientationSensor (Generic Sensor API) con cuaterniones [x,y,z,w]
 *      compensados en hardware por Android HAL sin gimbal lock.
 *    - Nivel 2: deviceorientationabsolute (W3C) con compensación trigonométrica 3D de inclinación (pitch/roll).
 *    - Nivel 3: webkitCompassHeading (iOS / WebKit) con corrección geomagnética.
 *    - Nivel 4: GPS Course-Over-Ground (COG) derivado de TacticalLocationEngine cuando el dispositivo
 *      carece de magnetómetro físico (ej. Lenovo Tablet) o cuando el operador se desplaza (>0.5 m/s).
 *    - Nivel 5: Brújula Solar (alineación astronómica por el Sol) o Control Manual del Rumbo.
 * 2. Supresión de Jitter y Concurrencia Errática: Si un sensor absoluto está activo, se ignoran
 *    los eventos relativos de 'deviceorientation' para erradicar oscilaciones a 60 Hz.
 * 3. Filtro Vectorial Suavizador Circular: Mantiene el promedio trigonométrico en el plano unitario (seno/coseno),
 *    eliminando por completo los saltos bruscos en la discontinuidad 0° <-> 360°.
 * 4. Detección Proactiva de Hardware: Identifica si el dispositivo carece de magnetómetro para
 *    conmutar limpiamente a modo GPS COG / Solar / Manual y notificar a la interfaz.
 */

import { TacticalLocationEngine, TacticalLocation } from './TacticalLocationEngine';

export type CompassHeadingSource = 'magnetometer' | 'gps_cog' | 'solar' | 'manual';

export interface CompassTelemetry {
    headingDeg: number;
    cardinal: string;
    source: CompassHeadingSource;
    hasHardwareMagnetometer: boolean;
    hasMagnetometer?: boolean;
    pitchDeg: number;
    rollDeg: number;
    accuracyDeg?: number;
    timestamp: number;
}

export type TacticalCompassTelemetry = CompassTelemetry;

export class TacticalCompassEngine {
    private static instance: TacticalCompassEngine | null = null;

    private headingDeg: number = 0;
    private pitchDeg: number = 0;
    private rollDeg: number = 0;
    private source: CompassHeadingSource = 'manual';
    private hasHardwareMagnetometer: boolean = false;
    private hasReceivedAbsoluteReading: boolean = false;

    // Filtro vectorial circular (seno/coseno)
    private vecX: number = 0;
    private vecY: number = 0;
    private readonly filterFactor: number = 0.22; // 22% nueva lectura, 78% inercia previa

    // Sensores y listeners
    private absoluteSensor: any = null;
    private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
    private absoluteOrientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
    private unsubGps: (() => void) | null = null;
    private hardwareCheckTimer: any = null;

    private listeners: Set<(t: CompassTelemetry) => void> = new Set();
    private isListening: boolean = false;
    private lastAbsoluteReadingTs: number = 0;

    private constructor() {
        // Cargar último rumbo manual o persistido
        if (typeof window !== 'undefined') {
            try {
                const savedHeading = localStorage.getItem('red_tactical_last_heading');
                if (savedHeading) {
                    const parsed = parseFloat(savedHeading);
                    if (isFinite(parsed) && parsed >= 0 && parsed <= 360) {
                        this.headingDeg = Math.round(parsed);
                    }
                }
            } catch {}
        }
    }

    public static getInstance(): TacticalCompassEngine {
        if (!this.instance) {
            this.instance = new TacticalCompassEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: CompassTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.getTelemetry());

        if (!this.isListening) {
            this.startListening();
        }

        return () => {
            this.listeners.delete(cb);
            if (this.listeners.size === 0) {
                this.stopListening();
            }
        };
    }

    private notify() {
        const telemetry = this.getTelemetry();
        this.listeners.forEach(cb => {
            try { cb(telemetry); } catch {}
        });
    }

    public getTelemetry(): CompassTelemetry {
        return {
            headingDeg: this.headingDeg,
            cardinal: TacticalCompassEngine.getCardinal(this.headingDeg),
            source: this.source,
            hasHardwareMagnetometer: this.hasHardwareMagnetometer,
            hasMagnetometer: this.hasHardwareMagnetometer,
            pitchDeg: this.pitchDeg,
            rollDeg: this.rollDeg,
            timestamp: Date.now()
        };
    }

    public static getCardinal(deg: number): string {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const idx = Math.round(((deg % 360) / 22.5)) % 16;
        return dirs[idx];
    }

    /**
     * Aplica filtro vectorial de paso bajo en el círculo unitario para evitar saltos en 0° <-> 360°
     */
    private updateSmoothHeading(rawDeg: number, source: CompassHeadingSource) {
        if (!isFinite(rawDeg) || isNaN(rawDeg)) return;

        const normalizedDeg = ((rawDeg % 360) + 360) % 360;
        const rad = (normalizedDeg * Math.PI) / 180;
        const curCos = Math.cos(rad);
        const curSin = Math.sin(rad);

        if (this.vecX === 0 && this.vecY === 0) {
            this.vecX = curCos;
            this.vecY = curSin;
        } else {
            this.vecX = this.vecX * (1 - this.filterFactor) + curCos * this.filterFactor;
            this.vecY = this.vecY * (1 - this.filterFactor) + curSin * this.filterFactor;
        }

        let smoothDeg = Math.round((Math.atan2(this.vecY, this.vecX) * 180) / Math.PI);
        smoothDeg = ((smoothDeg % 360) + 360) % 360;

        this.headingDeg = smoothDeg;
        this.source = source;

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('red_tactical_last_heading', String(smoothDeg));
            } catch {}
        }

        this.notify();
    }

    /**
     * Permite fijar manualmente el rumbo en dispositivos sin magnetómetro o para pruebas tácticas
     */
    public setManualHeading(deg: number) {
        this.updateSmoothHeading(deg, 'manual');
    }

    /**
     * Ajusta el rumbo actual por un incremento relativo en grados (ej: -15°, +15°)
     */
    public adjustManualHeading(deltaDeg: number) {
        const newHeading = (((this.headingDeg + deltaDeg) % 360) + 360) % 360;
        this.setManualHeading(newHeading);
    }

    /**
     * Calibra el rumbo actual tomando como referencia el acimut calculado del Sol (Brújula Solar)
     */
    public calibrateWithSolarAzimuth(solarAzimuthDeg: number) {
        this.updateSmoothHeading(solarAzimuthDeg, 'solar');
    }

    /**
     * Calibra automáticamente con la posición solar actual según latitud y longitud GNSS
     */
    public calibrateSolarAzimuth(lat: number, lon: number): number {
        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 0);
            const diff = now.getTime() - startOfYear.getTime();
            const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
            const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
            const timeUtcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
            const solarTimeHours = (timeUtcHours + lon / 15 + 24) % 24;
            const hourAngle = (solarTimeHours - 12) * 15;

            const latRad = (lat * Math.PI) / 180;
            const decRad = (declination * Math.PI) / 180;
            const haRad = (hourAngle * Math.PI) / 180;

            const sinElevation = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
            const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));

            const cosAzimuth = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(elevation)) / (Math.cos(latRad) * Math.cos(elevation));
            let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * (180 / Math.PI);
            if (Math.sin(haRad) > 0) azimuth = 360 - azimuth;

            const safeAzimuth = Math.round(((azimuth % 360) + 360) % 360);
            this.calibrateWithSolarAzimuth(safeAzimuth);
            return safeAzimuth;
        } catch {
            return this.headingDeg;
        }
    }

    /**
     * Obtiene una descripción legible y contextual de la fuente de rumbo actual
     */
    public getSourceDescription(source?: CompassHeadingSource): string {
        const s = source || this.source;
        switch (s) {
            case 'magnetometer':
                return '🧭 Magnetómetro Fusión 3D';
            case 'gps_cog':
                return '🛰️ Rumbo GPS Cinemático (COG)';
            case 'solar':
                return '☀️ Brújula Solar Calibrada';
            case 'manual':
            default:
                return this.hasHardwareMagnetometer ? '✋ Rumbo Manual' : '✋ Rumbo Manual (Sin Magnetómetro)';
        }
    }

    /**
     * Inicia la orquestación multi-nivel de sensores
     */
    public startListening() {
        if (this.isListening || typeof window === 'undefined') return;
        this.isListening = true;

        // ── Nivel 1: Generic Sensor API (AbsoluteOrientationSensor) ───────────
        try {
            const AbsoluteOrientation = (window as any).AbsoluteOrientationSensor;
            if (typeof AbsoluteOrientation === 'function') {
                const sensor = new AbsoluteOrientation({ frequency: 50, referenceFrame: 'device' });
                sensor.addEventListener('reading', () => {
                    if (sensor.quaternion && Array.isArray(sensor.quaternion) && sensor.quaternion.length === 4) {
                        const [x, y, z, w] = sensor.quaternion;
                        // Conversión de cuaternión a ángulo de yaw (rumbo) con compensación 3D nativa
                        const siny_cosp = 2 * (w * z + x * y);
                        const cosy_cosp = 1 - 2 * (y * y + z * z);
                        const yawRad = Math.atan2(siny_cosp, cosy_cosp);
                        let heading = ((-yawRad * 180 / Math.PI) + 360) % 360;

                        // Pitch (cabeceo)
                        const sinp = 2 * (w * y - z * x);
                        if (Math.abs(sinp) >= 1) {
                            this.pitchDeg = Math.round((Math.sign(sinp) * Math.PI / 2) * 180 / Math.PI);
                        } else {
                            this.pitchDeg = Math.round(Math.asin(sinp) * 180 / Math.PI);
                        }

                        // Roll (alabeo)
                        const sinr_cosp = 2 * (w * x + y * z);
                        const cosr_cosp = 1 - 2 * (x * x + y * y);
                        this.rollDeg = Math.round(Math.atan2(sinr_cosp, cosr_cosp) * 180 / Math.PI);

                        this.hasHardwareMagnetometer = true;
                        this.hasReceivedAbsoluteReading = true;
                        this.lastAbsoluteReadingTs = Date.now();
                        this.updateSmoothHeading(heading, 'magnetometer');
                    }
                });

                sensor.addEventListener('error', (err: any) => {
                    console.warn('[TacticalCompassEngine] AbsoluteOrientationSensor error:', err);
                });

                sensor.start();
                this.absoluteSensor = sensor;
            }
        } catch (e) {
            console.warn('[TacticalCompassEngine] AbsoluteOrientationSensor no soportado:', e);
        }

        // ── Nivel 2: W3C deviceorientationabsolute con Compensación de Inclinación 3D
        const handleDeviceOrientationAbsolute = (e: DeviceOrientationEvent) => {
            if (e.alpha !== null && isFinite(e.alpha)) {
                this.hasHardwareMagnetometer = true;
                this.hasReceivedAbsoluteReading = true;
                this.lastAbsoluteReadingTs = Date.now();

                const alpha = e.alpha;
                const beta = typeof e.beta === 'number' && isFinite(e.beta) ? e.beta : 0;
                const gamma = typeof e.gamma === 'number' && isFinite(e.gamma) ? e.gamma : 0;

                this.pitchDeg = Math.round(beta);
                this.rollDeg = Math.round(gamma);

                let heading = (360 - alpha) % 360;

                // Compensación de inclinación 3D si el dispositivo está inclinado en mano (> 15°)
                if (Math.abs(beta) > 15 || Math.abs(gamma) > 15) {
                    const bRad = (beta * Math.PI) / 180;
                    const gRad = (gamma * Math.PI) / 180;
                    const aRad = (alpha * Math.PI) / 180;

                    const cA = Math.cos(aRad), sA = Math.sin(aRad);
                    const cB = Math.cos(bRad), sB = Math.sin(bRad);
                    const cG = Math.cos(gRad), sG = Math.sin(gRad);

                    const rX = -cA * sG - sA * sB * cG;
                    const rY = -sA * cB;
                    if (Math.abs(rX) > 0.001 || Math.abs(rY) > 0.001) {
                        const tiltHeading = (Math.atan2(rY, rX) * 180) / Math.PI;
                        heading = ((tiltHeading % 360) + 360) % 360;
                    }
                }

                this.updateSmoothHeading(heading, 'magnetometer');
            }
        };

        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', handleDeviceOrientationAbsolute as any, true);
            this.absoluteOrientationHandler = handleDeviceOrientationAbsolute;
        }

        // ── Nivel 3: deviceorientation estándar (WebKit / iOS compass heading)
        const handleStandardDeviceOrientation = (e: DeviceOrientationEvent) => {
            // Si Nivel 1 o Nivel 2 están emitiendo lecturas absolutas en vivo, IGNORAR este evento para evitar jitter
            if (this.hasReceivedAbsoluteReading && (Date.now() - this.lastAbsoluteReadingTs < 1500)) {
                return;
            }

            const webkit = (e as any).webkitCompassHeading;
            if (webkit !== undefined && webkit !== null && isFinite(webkit)) {
                this.hasHardwareMagnetometer = true;
                this.hasReceivedAbsoluteReading = true;
                this.lastAbsoluteReadingTs = Date.now();
                if (typeof e.beta === 'number') this.pitchDeg = Math.round(e.beta);
                if (typeof e.gamma === 'number') this.rollDeg = Math.round(e.gamma);
                this.updateSmoothHeading(webkit, 'magnetometer');
                return;
            }

            // Si es un evento con absolute === true pero disparado en deviceorientation
            if ((e as any).absolute === true && e.alpha !== null && isFinite(e.alpha)) {
                this.hasHardwareMagnetometer = true;
                this.hasReceivedAbsoluteReading = true;
                this.lastAbsoluteReadingTs = Date.now();
                this.updateSmoothHeading((360 - e.alpha) % 360, 'magnetometer');
            }
        };

        window.addEventListener('deviceorientation', handleStandardDeviceOrientation, true);
        this.orientationHandler = handleStandardDeviceOrientation;

        // ── Nivel 4: Fallback a GPS Course-Over-Ground (COG) ───────────────────
        this.unsubGps = TacticalLocationEngine.watchLocation((loc: TacticalLocation) => {
            // Si el dispositivo carece de magnetómetro O el operador se está desplazando a > 0.6 m/s
            const isMoving = typeof loc.speed === 'number' && loc.speed >= 0.6;
            const lacksSensor = !this.hasHardwareMagnetometer;

            if ((lacksSensor || isMoving) && typeof loc.heading === 'number' && isFinite(loc.heading)) {
                this.updateSmoothHeading(loc.heading, 'gps_cog');
            }
        });

        // ── Detección de Presencia de Magnetómetro ────────────────────────────
        this.hardwareCheckTimer = setTimeout(() => {
            if (!this.hasReceivedAbsoluteReading) {
                this.hasHardwareMagnetometer = false;
                // Si no hay magnetómetro, intentar con GPS inmediatamente o pasar a manual
                const lastGps = TacticalLocationEngine.getLastKnownLocation();
                if (lastGps && typeof lastGps.heading === 'number' && isFinite(lastGps.heading)) {
                    this.updateSmoothHeading(lastGps.heading, 'gps_cog');
                } else if (this.source === 'magnetometer') {
                    this.source = 'manual';
                    this.notify();
                }
            }
        }, 1500);
    }

    /**
     * Detiene todos los listeners y limpia recursos del sensor
     */
    public stopListening() {
        this.isListening = false;

        if (this.hardwareCheckTimer) {
            clearTimeout(this.hardwareCheckTimer);
            this.hardwareCheckTimer = null;
        }

        if (this.absoluteSensor) {
            try { this.absoluteSensor.stop(); } catch {}
            this.absoluteSensor = null;
        }

        if (typeof window !== 'undefined') {
            if (this.absoluteOrientationHandler) {
                window.removeEventListener('deviceorientationabsolute', this.absoluteOrientationHandler as any, true);
                this.absoluteOrientationHandler = null;
            }
            if (this.orientationHandler) {
                window.removeEventListener('deviceorientation', this.orientationHandler, true);
                this.orientationHandler = null;
            }
        }

        if (this.unsubGps) {
            this.unsubGps();
            this.unsubGps = null;
        }
    }
}

export const tacticalCompass = TacticalCompassEngine.getInstance();

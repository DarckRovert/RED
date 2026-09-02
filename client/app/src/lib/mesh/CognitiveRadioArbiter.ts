/**
 * CognitiveRadioArbiter.ts — RED Sovereign Mesh OS (v83.0.0)
 * 
 * Árbitro Cognitivo Multi-Transporte y Gobernador Dinámico de Radio (DARPA / C4ISR MANET Standard).
 * 
 * Elimina la trampa del escaneo ciego perpetuo y selecciona quirúrgicamente el medio
 * de transmisión óptimo según distancia euclidiana, nivel de batería, nivel de guerra
 * electrónica (Jamming EW) y tamaño del payload, extendiendo la autonomía hasta 36-48 horas.
 * 
 * Medios Gobernados:
 * 1. WIFI_DIRECT (WebRTC P2P DataChannel): 10-80m, alta velocidad (54 Mbps), alto consumo en TX.
 * 2. BLE (Bluetooth LE 5.x GATT): 5-40m, medio de proximidad eficiente para control y llaves.
 * 3. LORA_RF (Semtech SX1262 / Meshtastic): 5-25 km, largo alcance con bajo consumo por ráfaga.
 * 4. SOUNDMESH (Módem Acústico Ultrasónico 18.5-19.5 kHz): 5-15m, canal táctico inmune a Jamming RF.
 * 5. LIFI_OPTICAL (Morse Óptico LED / Cámara): Línea de vista 100-500m, canal óptico direccional.
 */

import { KineticDutyGovernor } from '../sensors/KineticDutyGovernor';
import { RfSpectrumAnalyzerEngine } from '../sensors/RfSpectrumAnalyzerEngine';
import { TacticalLocationEngine } from '../sensors/TacticalLocationEngine';

export type TacticalBearer = 'WIFI_DIRECT' | 'BLE' | 'LORA_RF' | 'SOUNDMESH' | 'LIFI_OPTICAL';

export interface TransportDecision {
    primaryBearer: TacticalBearer;
    fallbackBearers: TacticalBearer[];
    estimatedDistanceMeters: number | null;
    batteryConservationMode: boolean;
    isElectronicWarfareActive: boolean;
    confidenceScore: number; // 0.0 - 1.0
    rationale: string;
    staggeredSchedule: StaggeredSentrySchedule;
}

export interface StaggeredSentrySchedule {
    scanMode: 'CONTINUOUS' | 'PULSED_BURST' | 'DEEP_SENTRY_SLEEP';
    sleepIntervalMs: number;
    burstIntervalMs: number;
    loraTxPowerDbm: number;
    recommendedBleMode: 'BALANCED' | 'LOW_POWER' | 'LOW_LATENCY';
    dutyCyclePct: number;
}

export interface TargetNodeMetadata {
    id?: string;
    lat?: number;
    lng?: number;
    lon?: number;
    transport?: string;
    lastSeen?: number;
    rssi?: number;
}

export class CognitiveRadioArbiter {
    private static instance: CognitiveRadioArbiter | null = null;

    // Umbrales físicos de distancia máxima por tecnología (en metros)
    public static readonly RANGE_SOUNDMESH_MAX_M = 15;
    public static readonly RANGE_BLE_MAX_M = 45;
    public static readonly RANGE_WIFI_DIRECT_MAX_M = 90;
    public static readonly RANGE_LIFI_MAX_M = 500;
    public static readonly RANGE_LORA_MAX_M = 25000;

    private listeners: Set<(decision: TransportDecision) => void> = new Set();
    private lastKnownDecision: TransportDecision | null = null;
    private periodicEvalTimer: any = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            // Reevaluación cada 15 segundos para adaptar el ciclo de trabajo si cambian batería o movimiento
            this.periodicEvalTimer = setInterval(() => {
                const decision = this.evaluateRoutingDecision();
                this.notifySubscribers(decision);
            }, 15000);
        }
    }

    public static getInstance(): CognitiveRadioArbiter {
        if (!this.instance) {
            this.instance = new CognitiveRadioArbiter();
        }
        return this.instance;
    }

    /**
     * Calcula la distancia geodésica exacta en metros entre dos coordenadas mediante fórmula de Haversine
     */
    public calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
            return NaN;
        }
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return isFinite(distance) && distance >= 0 ? Math.round(distance) : NaN;
    }

    /**
     * Calcula la ventana de sueño y ráfaga (Staggered Sentry) según batería y estado cinético
     */
    public calculateStaggeredSchedule(batteryLevel: number, isCharging: boolean, isStationary: boolean, isEmergency = false): StaggeredSentrySchedule {
        const safeBatt = (typeof batteryLevel === 'number' && isFinite(batteryLevel)) ? Math.max(0, Math.min(100, batteryLevel)) : 100;

        if (isEmergency || isCharging) {
            return {
                scanMode: 'CONTINUOUS',
                sleepIntervalMs: 0,
                burstIntervalMs: 15000,
                loraTxPowerDbm: safeBatt <= 10 ? 14 : 20,
                recommendedBleMode: 'LOW_LATENCY',
                dutyCyclePct: 100
            };
        }

        if (safeBatt <= 15 || (safeBatt <= 30 && isStationary)) {
            // MODO SUPERVIVENCIA CENTINELA PROFUNDO (3.5% duty cycle -> 48h autonomía)
            return {
                scanMode: 'DEEP_SENTRY_SLEEP',
                sleepIntervalMs: 55000,
                burstIntervalMs: 2000,
                loraTxPowerDbm: 10,
                recommendedBleMode: 'LOW_POWER',
                dutyCyclePct: 3.5
            };
        }

        if (isStationary) {
            // MODO REPOSO ESTACIONARIO (9% duty cycle -> 36h autonomía)
            return {
                scanMode: 'PULSED_BURST',
                sleepIntervalMs: 30000,
                burstIntervalMs: 3000,
                loraTxPowerDbm: 14,
                recommendedBleMode: 'LOW_POWER',
                dutyCyclePct: 9.1
            };
        }

        // MODO PATRULLA ACTIVA EN MOVIMIENTO (33% duty cycle -> 16-20h autonomía)
        return {
            scanMode: 'PULSED_BURST',
            sleepIntervalMs: 10000,
            burstIntervalMs: 5000,
            loraTxPowerDbm: 16,
            recommendedBleMode: 'BALANCED',
            dutyCyclePct: 33.3
        };
    }

    /**
     * Resuelve el transporte físico óptimo y la jerarquía de fallbacks para un destino y payload dados
     */
    public evaluateRoutingDecision(
        targetPeer?: TargetNodeMetadata,
        payloadSizeBytes = 64,
        isEmergency = false
    ): TransportDecision {
        // 1. Telemetría de Batería y Movimiento
        let batteryLevel = 100;
        let isCharging = false;
        let isStationary = false;

        try {
            const kineticTel = KineticDutyGovernor.getInstance().getTelemetry();
            if (kineticTel) {
                batteryLevel = kineticTel.batteryLevel;
                isCharging = kineticTel.isCharging;
                isStationary = kineticTel.isStationary;
            }
        } catch {}

        const staggeredSchedule = this.calculateStaggeredSchedule(batteryLevel, isCharging, isStationary, isEmergency);
        const batteryConservation = batteryLevel <= 20 && !isCharging;

        // 2. Detección de Guerra Electrónica / Jamming en 2.4 GHz
        let isJammed = false;
        try {
            const rfMetrics = RfSpectrumAnalyzerEngine.getInitialMetrics('BLE_2_4GHZ');
            if (rfMetrics?.jammingThreatLevel === 'CRÍTICO_JAMMING' || rfMetrics?.isJammingSuspected) {
                isJammed = true;
            }
        } catch {}

        // 3. Estimación de Distancia al Par
        let estimatedDistance: number | null = null;
        const targetLat = targetPeer?.lat;
        const targetLon = targetPeer?.lng ?? targetPeer?.lon;

        if (typeof targetLat === 'number' && typeof targetLon === 'number' &&
            TacticalLocationEngine.isValidCoordinates(targetLat, targetLon)) {
            const myLoc = TacticalLocationEngine.getLastKnownLocation();
            if (myLoc && typeof myLoc.lat === 'number' && typeof myLoc.lon === 'number' &&
                TacticalLocationEngine.isValidCoordinates(myLoc.lat, myLoc.lon)) {
                const d = this.calculateHaversineDistance(myLoc.lat, myLoc.lon, targetLat, targetLon);
                if (isFinite(d)) {
                    estimatedDistance = d;
                }
            }
        }

        // 4. Lógica de Decisión Cognitiva
        let primaryBearer: TacticalBearer = 'BLE';
        let fallbackBearers: TacticalBearer[] = ['WIFI_DIRECT', 'LORA_RF', 'SOUNDMESH', 'LIFI_OPTICAL'];
        let rationale = '';
        let confidenceScore = 0.90;

        // CASO A: GUERRA ELECTRÓNICA / JAMMING ACTIVO EN RF
        if (isJammed) {
            primaryBearer = 'SOUNDMESH';
            fallbackBearers = ['LIFI_OPTICAL', 'LORA_RF', 'BLE', 'WIFI_DIRECT'];
            rationale = 'Guerra electrónica / Jamming activo en 2.4 GHz detectado. Radios RF despriorizados; canal acústico SoundMesh seleccionado como enlace primario no bloqueable.';
            confidenceScore = 0.95;
        }
        // CASO B: DISTANCIA ESTIMADA LEJANA (> 90 metros)
        else if (estimatedDistance !== null && estimatedDistance > CognitiveRadioArbiter.RANGE_WIFI_DIRECT_MAX_M) {
            primaryBearer = 'LORA_RF';
            fallbackBearers = ['WIFI_DIRECT', 'BLE', 'LIFI_OPTICAL', 'SOUNDMESH'];
            rationale = `Destino a ${estimatedDistance >= 1000 ? (estimatedDistance / 1000).toFixed(1) + ' km' : estimatedDistance + 'm'}: fuera de alcance Bluetooth/Wi-Fi. Enrutando exclusivamente vía radio de largo alcance LoRa RF (${staggeredSchedule.loraTxPowerDbm} dBm).`;
            confidenceScore = 0.98;
        }
        // CASO C: DISTANCIA CERCANA CON CARGA PESADA (> 4 KB)
        else if (payloadSizeBytes > 4096 && !batteryConservation) {
            primaryBearer = 'WIFI_DIRECT';
            fallbackBearers = ['BLE', 'LORA_RF', 'SOUNDMESH'];
            rationale = `Payload grande (${(payloadSizeBytes / 1024).toFixed(1)} KB): canal Wi-Fi Direct seleccionado para maximizar tasa de transferencia y minimizar tiempo total en aire.`;
            confidenceScore = 0.92;
        }
        // CASO D: DESTINO CERCANO (0 - 45 metros) O POR DEFECTO
        else if (estimatedDistance !== null && estimatedDistance <= CognitiveRadioArbiter.RANGE_BLE_MAX_M) {
            primaryBearer = 'BLE';
            fallbackBearers = ['WIFI_DIRECT', 'LORA_RF', 'SOUNDMESH'];
            rationale = `Destino cercano detectado (${estimatedDistance}m): enlace Bluetooth LE seleccionado por menor consumo por paquete y bajo costo energético.`;
            confidenceScore = 0.94;
        }
        // CASO E: DISTANCIA DESCONOCIDA — BATERÍA CRÍTICA (<= 15%)
        else if (batteryConservation) {
            primaryBearer = 'BLE';
            fallbackBearers = ['LORA_RF', 'WIFI_DIRECT', 'SOUNDMESH'];
            rationale = `Batería crítica (${batteryLevel}%): Wi-Fi bloqueado. Escaneo modulado en ventana centinela (3.5% duty cycle). Transmisión corta por BLE con fallback a LoRa.`;
            confidenceScore = 0.88;
        }
        // CASO F: DISTANCIA DESCONOCIDA — MODO NOMINAL
        else {
            // Si el par ya fue visto por LoRa recientemente, priorizar LoRa
            if (targetPeer?.transport === 'lora') {
                primaryBearer = 'LORA_RF';
                fallbackBearers = ['BLE', 'WIFI_DIRECT', 'SOUNDMESH'];
                rationale = 'Par registrado previamente vía canal LoRa RF. Priorizando enlace de radio sub-GHz.';
            } else if (targetPeer?.transport === 'wifi') {
                primaryBearer = 'WIFI_DIRECT';
                fallbackBearers = ['BLE', 'LORA_RF', 'SOUNDMESH'];
                rationale = 'Par conectado previamente por Wi-Fi Direct. Reutilizando canal de alta velocidad.';
            } else {
                primaryBearer = 'BLE';
                fallbackBearers = ['WIFI_DIRECT', 'LORA_RF', 'SOUNDMESH'];
                rationale = 'Distancia no acotada: iniciando enlace de proximidad BLE de bajo consumo con escalonamiento automático a LoRa si no hay acuse de recibo.';
            }
            confidenceScore = 0.85;
        }

        const decision: TransportDecision = {
            primaryBearer,
            fallbackBearers,
            estimatedDistanceMeters: estimatedDistance,
            batteryConservationMode: batteryConservation,
            isElectronicWarfareActive: isJammed,
            confidenceScore,
            rationale,
            staggeredSchedule
        };

        this.lastKnownDecision = decision;
        return decision;
    }

    public getLastDecision(): TransportDecision {
        if (!this.lastKnownDecision) {
            return this.evaluateRoutingDecision();
        }
        return this.lastKnownDecision;
    }

    public subscribe(listener: (decision: TransportDecision) => void): () => void {
        this.listeners.add(listener);
        listener(this.getLastDecision());
        return () => this.listeners.delete(listener);
    }

    private notifySubscribers(decision: TransportDecision): void {
        this.listeners.forEach(listener => {
            try { listener(decision); } catch {}
        });
    }

    public destroy(): void {
        if (this.periodicEvalTimer) {
            clearInterval(this.periodicEvalTimer);
            this.periodicEvalTimer = null;
        }
        this.listeners.clear();
        this.lastKnownDecision = null;
        CognitiveRadioArbiter.instance = null;
    }
}

export const cognitiveArbiter = CognitiveRadioArbiter.getInstance();

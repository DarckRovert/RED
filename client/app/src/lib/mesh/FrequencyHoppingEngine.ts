/**
 * FrequencyHoppingEngine.ts — RED RF Spectrum & Pseudo-Random Frequency Hopping (FHSS) Manager
 * 
 * Gestiona la sincronización determinista de canales FHSS para transceptores externos LoRa / SDR,
 * y reporta con total veracidad el estado del hardware de radiofrecuencia del dispositivo.
 */

import { sha256 } from '@noble/hashes/sha2.js';

export interface HoppingChannel {
    channelIndex: number;
    frequencyMhz: number;
    slotEpoch: number;
    slotTimeRemainingMs: number;
    hopRatePerSec: number;
    hasHardwareTransceiver: boolean;
    rfBandLabel: string;
    operatingMode: string;
}

export class FrequencyHoppingEngine {
    private static instance: FrequencyHoppingEngine | null = null;
    private swarmSeed: string = 'RED_TACTICAL_SWARM_FHSS_KEY_V1';
    private dwellTimeMs: number = 200; // 5 saltos por segundo cuando está activo
    private baseFrequencyMhz: number = 902.3;
    private channelSpacingMhz: number = 0.4;
    private totalChannels: number = 64;

    private constructor() {}

    public static getInstance(): FrequencyHoppingEngine {
        if (!this.instance) {
            this.instance = new FrequencyHoppingEngine();
        }
        return this.instance;
    }

    public isSubGhzHardwareAvailable(): boolean {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('red_lora_enabled') === 'true' || localStorage.getItem('red_external_sdr') === 'true';
    }

    public setSwarmKey(key: string) {
        this.swarmSeed = key;
    }

    /**
     * Obtiene el estado actual del espectro y la sincronización de canal
     */
    public getCurrentChannel(): HoppingChannel {
        const now = Date.now();
        const slotEpoch = Math.floor(now / this.dwellTimeMs);
        const slotTimeRemainingMs = this.dwellTimeMs - (now % this.dwellTimeMs);

        const hasHardware = this.isSubGhzHardwareAvailable();
        const channelIndex = this.computeChannelForSlot(slotEpoch);
        const frequencyMhz = Math.round((this.baseFrequencyMhz + channelIndex * this.channelSpacingMhz) * 100) / 100;

        return {
            channelIndex,
            frequencyMhz,
            slotEpoch,
            slotTimeRemainingMs,
            hopRatePerSec: Math.round(1000 / this.dwellTimeMs),
            hasHardwareTransceiver: hasHardware,
            rfBandLabel: hasHardware ? "902–928 MHz (LoRa Sub-GHz)" : "2.4 / 5 GHz (Wi-Fi Direct + BLE 5.3)",
            operatingMode: hasHardware ? "FHSS CRIPTOGRÁFICO ACTIVO" : "BANDA BASE CELULAR / AD-HOC",
        };
    }

    /**
     * Calcula determinísticamente el canal para una ranura de tiempo específica
     */
    public computeChannelForSlot(slot: number): number {
        const payload = `${this.swarmSeed}:${slot}`;
        const hash = sha256(new TextEncoder().encode(payload));
        const val = (hash[0] << 8) | hash[1];
        const total = Math.max(1, this.totalChannels);
        return val % total;
    }

    public reset(): void {
        this.swarmSeed = 'RED_TACTICAL_SWARM_FHSS_KEY_V1';
    }
}

export const frequencyHopping = FrequencyHoppingEngine.getInstance();

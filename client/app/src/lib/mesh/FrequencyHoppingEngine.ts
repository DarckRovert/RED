/**
 * FrequencyHoppingEngine.ts — RED Pseudo-Random Frequency Hopping Spread Spectrum (FHSS) Engine
 * 
 * Generates cryptographic, time-synchronized channel hopping sequences across 64 ISM channels (902-928 MHz)
 * with 200ms slot dwell times to evade narrow-band and sweeping RF jamming countermeasures.
 */

import { sha256 } from '@noble/hashes/sha2.js';

export interface HoppingChannel {
    channelIndex: number;
    frequencyMhz: number;
    slotEpoch: number;
    slotTimeRemainingMs: number;
    hopRatePerSec: number;
}

export class FrequencyHoppingEngine {
    private static instance: FrequencyHoppingEngine | null = null;
    private swarmSeed: string = 'RED_TACTICAL_SWARM_FHSS_KEY_V1';
    private dwellTimeMs: number = 200; // 5 saltos por segundo
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

    public setSwarmKey(key: string) {
        this.swarmSeed = key;
    }

    /**
     * Obtiene el canal y frecuencia actual correspondiente a la ranura de tiempo en curso
     */
    public getCurrentChannel(): HoppingChannel {
        const now = Date.now();
        const slotEpoch = Math.floor(now / this.dwellTimeMs);
        const slotTimeRemainingMs = this.dwellTimeMs - (now % this.dwellTimeMs);

        const channelIndex = this.computeChannelForSlot(slotEpoch);
        const frequencyMhz = Math.round((this.baseFrequencyMhz + channelIndex * this.channelSpacingMhz) * 100) / 100;

        return {
            channelIndex,
            frequencyMhz,
            slotEpoch,
            slotTimeRemainingMs,
            hopRatePerSec: Math.round(1000 / this.dwellTimeMs),
        };
    }

    /**
     * Calcula determinísticamente el canal para una ranura de tiempo específica
     */
    public computeChannelForSlot(slot: number): number {
        const payload = `${this.swarmSeed}:${slot}`;
        const hash = sha256(new TextEncoder().encode(payload));
        // Tomar los primeros 2 bytes para determinar el canal 0..63
        const val = (hash[0] << 8) | hash[1];
        return val % this.totalChannels;
    }

    /**
     * Genera la secuencia futura de los próximos saltos de frecuencia
     */
    public getUpcomingHops(count: number = 5): Array<{ slot: number; channel: number; freqMhz: number }> {
        const currentSlot = Math.floor(Date.now() / this.dwellTimeMs);
        const hops = [];

        for (let i = 0; i < count; i++) {
            const slot = currentSlot + i;
            const channel = this.computeChannelForSlot(slot);
            const freqMhz = Math.round((this.baseFrequencyMhz + channel * this.channelSpacingMhz) * 100) / 100;
            hops.push({ slot, channel, freqMhz });
        }

        return hops;
    }
}

export const frequencyHopping = FrequencyHoppingEngine.getInstance();

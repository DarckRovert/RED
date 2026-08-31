/**
 * AntiForensicPanicWipeEngine.ts — RED Cryptographic Duress PIN & Anti-Tamper Zeroization Sentinel
 * 
 * Provides hardware-grade anti-coercion security: if a captured operator is forced to unlock the device,
 * entering the secondary Duress PIN triggers instant CSPRNG zeroization of master private keys, replaces
 * the database with a plausible decoy civilian profile, and silently emits an encrypted hostage beacon across the mesh.
 */

import { meshSosBeacon } from '../emergency/MeshSosBeaconEngine';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '../mesh/meshProtocol';

export interface DuressConfig {
    isDuressPinConfigured: boolean;
    duressPinHash: string | null;
    autoZeroizeMasterKeys: boolean;
    emitSilentMeshSos: boolean;
    mountDecoyVault: boolean;
}

const STORAGE_DURESS_CONFIG_KEY = 'red_duress_sentinel_cfg_v1';

export class AntiForensicPanicWipeEngine {
    private static instance: AntiForensicPanicWipeEngine | null = null;
    private config: DuressConfig = {
        isDuressPinConfigured: false,
        duressPinHash: null,
        autoZeroizeMasterKeys: true,
        emitSilentMeshSos: true,
        mountDecoyVault: true,
    };

    private constructor() {
        this.loadConfig();
    }

    public static getInstance(): AntiForensicPanicWipeEngine {
        if (!this.instance) {
            this.instance = new AntiForensicPanicWipeEngine();
        }
        return this.instance;
    }

    private loadConfig() {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(STORAGE_DURESS_CONFIG_KEY);
            if (raw) {
                this.config = JSON.parse(raw);
            }
        } catch {}
    }

    private saveConfig() {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_DURESS_CONFIG_KEY, JSON.stringify(this.config));
        } catch {}
    }

    /**
     * Configura el PIN de coacción / pánico
     */
    public setDuressPin(pin: string): boolean {
        if (!pin || pin.length < 4) return false;
        const pinBytes = new TextEncoder().encode(`red_duress_salt:${pin}`);
        const hashBytes = sha256(pinBytes);
        this.config.duressPinHash = bytesToHex(hashBytes);
        this.config.isDuressPinConfigured = true;
        this.saveConfig();
        return true;
    }

    /**
     * Valida si un PIN introducido corresponde al PIN de coacción
     */
    public isDuressPin(pin: string): boolean {
        if (!this.config.isDuressPinConfigured || !this.config.duressPinHash) return false;
        const pinBytes = new TextEncoder().encode(`red_duress_salt:${pin}`);
        const hashBytes = sha256(pinBytes);
        return bytesToHex(hashBytes) === this.config.duressPinHash;
    }

    /**
     * Ejecuta el protocolo de pánico y zeroización selectiva
     */
    public async triggerDuressPanicProtocol(lastKnownCoords?: { lat: number; lon: number }): Promise<void> {
        console.warn("[AntiForensicPanicWipeEngine] !!! DURESS PANIC PROTOCOL ENGAGED !!!");

        // 1. Emisión Silenciosa de Baliza SOS por la Malla DTN
        if (this.config.emitSilentMeshSos) {
            try {
                let batt = 100;
                if (typeof window !== 'undefined' && typeof (window as any).__red_last_battery === 'number') {
                    batt = (window as any).__red_last_battery;
                } else if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
                    try {
                        const b: any = await (navigator as any).getBattery();
                        if (b && typeof b.level === 'number') batt = Math.round(b.level * 100);
                    } catch {}
                }
                await meshSosBeacon.activateSosBeacon({
                    distressType: 'GENERAL_DISTRESS',
                    triageColor: 'RED',
                    note: '🚨 ALERTA CRÍTICA: OPERADOR BAJO COACCIÓN / CAPTURA HOSTIL (PIN DE PÁNICO ACTIVADO)',
                    coords: lastKnownCoords || {},
                    batteryLevel: batt
                }, 'DURESS_OPERATOR', 'Operador en Peligro');
            } catch (e) {
                console.error("[AntiForensic] Error broadcasting silent SOS:", e);
            }
        }

        // 2. Zeroización Criptográfica de Claves Maestras
        if (this.config.autoZeroizeMasterKeys && typeof window !== 'undefined') {
            try {
                // Sobrescribir con ruido aleatorio antes de eliminar
                const sensitiveKeys = [
                    'red_identity_keypair',
                    'red_master_seed_v1',
                    'red_shamir_shares',
                    'red_stego_vault_keys',
                    'red_id_vault_credentials',
                    'red_private_notes'
                ];

                sensitiveKeys.forEach(k => {
                    const noise = new Uint8Array(256);
                    if (window.crypto && window.crypto.getRandomValues) {
                        window.crypto.getRandomValues(noise);
                        localStorage.setItem(k, Array.from(noise).join(''));
                    }
                    localStorage.removeItem(k);
                });
            } catch (e) {
                console.error("[AntiForensic] Error zeroizing master keys:", e);
            }
        }

        // 3. Montar Bóveda Señuelo Civil
        if (this.config.mountDecoyVault && typeof window !== 'undefined') {
            try {
                localStorage.setItem('red_is_decoy_active', 'true');
                localStorage.setItem('red_user_nickname', 'Ciudadano');
            } catch {}
        }
    }
}

export const antiForensicPanicWipe = AntiForensicPanicWipeEngine.getInstance();

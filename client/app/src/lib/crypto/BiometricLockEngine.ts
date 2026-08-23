/**
 * RED 2.0 — Sovereign Biometric Lock & App Shield Engine
 * Integrates native biometric authentication (Fingerprint / Face ID) with inactivity timeouts
 * and fallback master security PIN to protect local cryptographic vault and messages.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export type BiometricTimeout = "immediate" | "1m" | "5m" | "15m" | "off";

export interface BiometricStatus {
    isAvailable: boolean;
    biometryType: string;
    isEnabled: boolean;
    timeout: BiometricTimeout;
    isLocked: boolean;
}

const STORAGE_ENABLED_KEY = "red_biometric_enabled";
const STORAGE_TIMEOUT_KEY = "red_biometric_timeout";
const STORAGE_LAST_ACTIVE_KEY = "red_biometric_last_active";
const STORAGE_PIN_KEY = "red_biometric_pin_hash";

export class BiometricLockEngine {
    private static isLockedState = false;
    private static listeners: ((locked: boolean) => void)[] = [];

    public static init(): boolean {
        if (typeof window === "undefined") return false;
        const isEnabled = localStorage.getItem(STORAGE_ENABLED_KEY) === "true";
        if (!isEnabled) {
            this.isLockedState = false;
            return false;
        }

        const timeout = (localStorage.getItem(STORAGE_TIMEOUT_KEY) as BiometricTimeout) || "5m";
        if (timeout === "off") {
            this.isLockedState = false;
            return false;
        }

        const lastActiveStr = localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
        const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
        const now = Date.now();

        let thresholdMs = 5 * 60 * 1000;
        if (timeout === "immediate") thresholdMs = 0;
        else if (timeout === "1m") thresholdMs = 60 * 1000;
        else if (timeout === "5m") thresholdMs = 5 * 60 * 1000;
        else if (timeout === "15m") thresholdMs = 15 * 60 * 1000;

        if (now - lastActive > thresholdMs) {
            this.isLockedState = true;
            this.notifyListeners(true);
            return true;
        }

        this.updateActivity();
        return false;
    }

    public static subscribe(listener: (locked: boolean) => void): () => void {
        this.listeners.push(listener);
        listener(this.isLockedState);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private static notifyListeners(locked: boolean) {
        this.listeners.forEach((l) => l(locked));
    }

    public static isLocked(): boolean {
        return this.isLockedState;
    }

    public static updateActivity() {
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, Date.now().toString());
        }
    }

    public static async checkAvailability(): Promise<{ isAvailable: boolean; biometryType: string }> {
        if (typeof window === "undefined") return { isAvailable: false, biometryType: "None" };

        try {
            if (Capacitor.isNativePlatform()) {
                const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
                const res = await BiometricAuth.checkBiometry();
                return {
                    isAvailable: res.isAvailable,
                    biometryType: res.biometryTypes?.join(", ") || (res.isAvailable ? "Biometría Nativa" : "No disponible"),
                };
            }
        } catch {}

        return { isAvailable: false, biometryType: "PIN de Seguridad Web" };
    }

    public static async authenticate(reason = "Desbloquear Bóveda Criptográfica RED"): Promise<boolean> {
        try {
            if (Capacitor.isNativePlatform()) {
                const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
                await BiometricAuth.authenticate({
                    reason,
                    cancelTitle: "Cancelar",
                    allowDeviceCredential: true,
                    iosFallbackTitle: "Usar Contraseña",
                });
                this.isLockedState = false;
                this.updateActivity();
                this.notifyListeners(false);
                return true;
            }
        } catch (e: any) {
            console.warn("[BiometricLockEngine] Biometric auth failed:", e);
        }

        return false;
    }

    public static verifyPin(pin: string): boolean {
        if (typeof window === "undefined") return false;
        const savedHash = localStorage.getItem(STORAGE_PIN_KEY);
        if (!savedHash) {
            // Predeterminado si no hay PIN personalizado: 0000
            if (pin === "0000") {
                this.isLockedState = false;
                this.updateActivity();
                this.notifyListeners(false);
                return true;
            }
            return false;
        }

        const inputHash = this.hashPin(pin);
        if (inputHash === savedHash) {
            this.isLockedState = false;
            this.updateActivity();
            this.notifyListeners(false);
            return true;
        }
        return false;
    }

    public static setPin(newPin: string) {
        if (typeof window === "undefined") return;
        const hash = this.hashPin(newPin);
        localStorage.setItem(STORAGE_PIN_KEY, hash);
    }

    public static setEnabled(enabled: boolean) {
        if (typeof window === "undefined") return;
        localStorage.setItem(STORAGE_ENABLED_KEY, enabled ? "true" : "false");
        if (!enabled) {
            this.isLockedState = false;
            this.notifyListeners(false);
        }
    }

    public static setTimeout(timeout: BiometricTimeout) {
        if (typeof window === "undefined") return;
        localStorage.setItem(STORAGE_TIMEOUT_KEY, timeout);
    }

    public static getStatus(): BiometricStatus {
        if (typeof window === "undefined") {
            return { isAvailable: false, biometryType: "None", isEnabled: false, timeout: "off", isLocked: false };
        }
        return {
            isAvailable: true,
            biometryType: "Biometría / PIN",
            isEnabled: localStorage.getItem(STORAGE_ENABLED_KEY) === "true",
            timeout: (localStorage.getItem(STORAGE_TIMEOUT_KEY) as BiometricTimeout) || "5m",
            isLocked: this.isLockedState,
        };
    }

    private static hashPin(pin: string): string {
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
            hash = (hash << 5) - hash + pin.charCodeAt(i);
            hash |= 0;
        }
        return `pin_${hash}_salt_red`;
    }
}

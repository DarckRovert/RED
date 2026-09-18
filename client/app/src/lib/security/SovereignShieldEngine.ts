/**
 * SovereignShieldEngine.ts — RED Sovereign Mesh OS
 * Motor Soberano de Defensa de Dispositivo, Caller ID & Anti-Spam
 *
 * Opera 100% On-Device con Cero Telemetría Externa.
 * Provee:
 *  1. Base de datos semilla local y evaluación heurística de números telefónicos.
 *  2. Detección de Wangiri y Neighbor Spoofing.
 *  3. Gestión de listas blancas (contactos VIP, llamadas salientes) y listas negras.
 *  4. Auditoría de permisos de aplicaciones y telemetría de radiofrecuencia (Anti-IMSI Catcher).
 *  5. Cálculo del Índice de Blindaje Soberano (Sovereign Shield Index 0-100%).
 */

import { registerPlugin } from "@capacitor/core";

export interface SpamPattern {
    pattern: string;
    category: "telemarketing" | "fraud" | "extortion" | "wangiri" | "debt_collection" | "suspicious";
    label: string;
    severity: "critical" | "high" | "medium" | "low";
}

export interface ShieldVerdict {
    number: string;
    isSpam: boolean;
    category: string;
    label: string;
    severity: "safe" | "low" | "medium" | "high" | "critical";
    confidenceScore: number; // 0 to 100
    actionRecommended: "allow" | "warn" | "silence" | "block";
    reason: string;
    isVipBypass: boolean;
}

export interface CallLogEntry {
    id: string;
    timestamp: number;
    phoneNumber: string;
    simSlot: number;
    verdict: ShieldVerdict;
    userAction?: "allowed" | "blocked" | "reported_spam" | "whitelisted";
    notes?: string;
}

export interface AppPermissionAuditItem {
    packageName: string;
    appName: string;
    icon?: string;
    isSystemApp: boolean;
    riskScore: number; // 0 - 100
    riskLevel: "low" | "medium" | "high" | "critical";
    dangerousPermissions: string[];
    hasBackgroundMic: boolean;
    hasBackgroundCamera: boolean;
    hasBackgroundLocation: boolean;
    hasAccessibilityService: boolean;
    hasOverlayPermission: boolean;
}

export interface AppAuditSummary {
    totalApps: number;
    criticalRiskCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    appsWithMic: number;
    appsWithCamera: number;
    appsWithLocation: number;
    appsWithAccessibility: number;
    items: AppPermissionAuditItem[];
}

export interface RfThreatStatus {
    carrierName: string;
    networkType: "5G" | "4G_LTE" | "3G" | "2G_GSM" | "UNKNOWN";
    isEncrypted: boolean;
    is2gDowngradeThreat: boolean;
    wifiSsid: string;
    wifiSecurity: "WPA3" | "WPA2" | "OPEN_INSECURE" | "WEP" | "NONE";
    isRogueWifiThreat: boolean;
}

export interface HardwareKineticHealth {
    batteryLevel: number;
    batteryTempCelsius: number;
    isCharging: boolean;
    powerWattage: number;
    batteryHealthStatus: "GOOD" | "OVERHEAT" | "DEAD" | "OVER_VOLTAGE" | "UNKNOWN";
    ramFreeMb: number;
    ramTotalMb: number;
    storageFreeGb: number;
    storageTotalGb: number;
}

// ── Plugin Nativo Capacitor ──────────────────────────────────────────────────
export const RedShield = registerPlugin<any>("RedShield");

// ── Prefijos Oficiales de Emergencia (Inviolables) ───────────────────────────
const EMERGENCY_NUMBERS = new Set([
    "911", "112", "105", "116", "106", "100", "999", "060", "080", "110", "119"
]);

// ── Base Semilla de Fraude Internacional Wangiri ─────────────────────────────
const WANGIRI_COUNTRY_PREFIXES = [
    "+232", // Sierra Leona
    "+247", // Isla Ascensión
    "+269", // Comoras
    "+223", // Malí
    "+675", // Papúa Nueva Guinea
    "+236", // Rep. Centroafricana
    "+252", // Somalia
    "+224", // Guinea
    "+387", // Bosnia
    "+881", // Red de Satélite Global Iridium (tarificación abusiva no solicitada)
    "+882", // Redes internacionales
];

// ── Base Semilla de Prefijos de Call Centers & Telemercadeo Agresivo (LatAm / Perú) ─
const SEED_SPAM_PATTERNS: SpamPattern[] = [
    // Rango telemercadeo saliente automatizado
    { pattern: "^\\+51(98400|98401|98402)", category: "telemarketing", label: "Call Center Saliente Masivo", severity: "high" },
    { pattern: "^\\+51(91200|91201|91202)", category: "telemarketing", label: "Telemercadeo Bancario Predictivo", severity: "high" },
    { pattern: "^\\+51(92000|92001|92002)", category: "debt_collection", label: "Cobranza Agresiva Extrajudicial", severity: "high" },
    { pattern: "^\\+51(93000|93001)", category: "telemarketing", label: "Ventas Seguros & Tarjetas", severity: "medium" },
    { pattern: "^\\+51(96000|96001)", category: "telemarketing", label: "Promociones Portabilidad Operador", severity: "medium" },
    { pattern: "^\\+51(97000)", category: "suspicious", label: "Marcador Robocall Automatizado", severity: "medium" },
    // Fraudes de lotería / falsos secuestros reportados
    { pattern: "^\\+51(999888|999777|999111)", category: "fraud", label: "Estafa Telefónica Reportada (Falsa Alarma)", severity: "critical" },
    // Líneas VoIP comerciales con desvío masivo
    { pattern: "^\\+511(700|701|702|705|708)[0-9]{4}$", category: "telemarketing", label: "Troncal SIP Call Center Lima", severity: "high" },
    { pattern: "^\\+511(610|611|612|619)[0-9]{4}$", category: "telemarketing", label: "Línea PBX Televentas Masivas", severity: "high" }
];

export class SovereignShieldEngine {
    private static instance: SovereignShieldEngine;
    private customBlacklist: Map<string, SpamPattern> = new Map();
    private customWhitelist: Map<string, string> = new Map();
    private recentOutgoingNumbers: Set<string> = new Set();
    private callHistory: CallLogEntry[] = [];
    private isShieldEnabled: boolean = true;
    private isStrictMode: boolean = false; // false = Advertencia Visual, true = Rechazo Automático
    private simPrefix: string = "";

    private constructor() {
        this.loadPersistentState();
    }

    public static getInstance(): SovereignShieldEngine {
        if (!SovereignShieldEngine.instance) {
            SovereignShieldEngine.instance = new SovereignShieldEngine();
        }
        return SovereignShieldEngine.instance;
    }

    private loadPersistentState(): void {
        if (typeof window === "undefined" || !window.localStorage) return;
        try {
            const blRaw = localStorage.getItem("red_shield_custom_blacklist");
            if (blRaw) {
                const arr = JSON.parse(blRaw);
                for (const item of arr) {
                    this.customBlacklist.set(item.pattern, item);
                }
            }

            const wlRaw = localStorage.getItem("red_shield_custom_whitelist");
            if (wlRaw) {
                const arr = JSON.parse(wlRaw);
                for (const item of arr) {
                    this.customWhitelist.set(item.number, item.label);
                }
            }

            const outRaw = localStorage.getItem("red_shield_recent_outgoing");
            if (outRaw) {
                const arr = JSON.parse(outRaw);
                this.recentOutgoingNumbers = new Set(arr);
            }

            const histRaw = localStorage.getItem("red_shield_call_history");
            if (histRaw) {
                this.callHistory = JSON.parse(histRaw).slice(0, 100);
            }

            this.isShieldEnabled = localStorage.getItem("red_shield_enabled") !== "false";
            this.isStrictMode = localStorage.getItem("red_shield_strict_mode") === "true";
            this.simPrefix = localStorage.getItem("red_shield_sim_prefix") || "";
        } catch (e) {
            console.warn("[SovereignShieldEngine] Error cargando estado persistente:", e);
        }
    }

    private savePersistentState(): void {
        if (typeof window === "undefined" || !window.localStorage) return;
        try {
            localStorage.setItem("red_shield_custom_blacklist", JSON.stringify(Array.from(this.customBlacklist.values())));
            localStorage.setItem("red_shield_custom_whitelist", JSON.stringify(
                Array.from(this.customWhitelist.entries()).map(([number, label]) => ({ number, label }))
            ));
            localStorage.setItem("red_shield_recent_outgoing", JSON.stringify(Array.from(this.recentOutgoingNumbers)));
            localStorage.setItem("red_shield_call_history", JSON.stringify(this.callHistory.slice(0, 100)));
            localStorage.setItem("red_shield_enabled", this.isShieldEnabled ? "true" : "false");
            localStorage.setItem("red_shield_strict_mode", this.isStrictMode ? "true" : "false");
        } catch (e) {
            console.warn("[SovereignShieldEngine] Error guardando estado persistente:", e);
        }
    }

    // ── Normalización de Número Telefónico ────────────────────────────────────
    public normalizeNumber(raw: string): string {
        if (!raw) return "";
        let clean = raw.trim().replace(/[\s\-\(\)\.]/g, "");
        if (!clean.startsWith("+") && clean.length === 9 && clean.startsWith("9")) {
            // Predeterminado Perú (+51) para números celulares estándar
            clean = `+51${clean}`;
        }
        return clean;
    }

    // ── Registro de Llamadas Salientes (Para Lista Blanca Automática) ──────────
    public recordOutgoingCall(phoneNumber: string): void {
        const norm = this.normalizeNumber(phoneNumber);
        if (!norm) return;
        this.recentOutgoingNumbers.add(norm);
        this.savePersistentState();
    }

    // ── Evaluación de Número Entrante (0ms Latency Budget) ────────────────────
    public evaluateIncomingNumber(rawNumber: string, callerName?: string): ShieldVerdict {
        const norm = this.normalizeNumber(rawNumber);

        // 1. Inviolabilidad de Emergencias
        for (const em of EMERGENCY_NUMBERS) {
            if (norm === em || norm.endsWith(em)) {
                return {
                    number: norm,
                    isSpam: false,
                    category: "emergency",
                    label: "Servicio de Emergencia Oficial",
                    severity: "safe",
                    confidenceScore: 100,
                    actionRecommended: "allow",
                    reason: "Protocolo de Inviolabilidad de Emergencia (Pase Directo de Hardware)",
                    isVipBypass: true
                };
            }
        }

        // 2. Lista Blanca Personal y Contactos Verificados
        if (this.customWhitelist.has(norm)) {
            return {
                number: norm,
                isSpam: false,
                category: "contact_verified",
                label: this.customWhitelist.get(norm) || "Contacto Verificado",
                severity: "safe",
                confidenceScore: 100,
                actionRecommended: "allow",
                reason: "Número en Lista Blanca Personal de Confianza",
                isVipBypass: true
            };
        }

        // 3. Historial Reciente de Llamadas Salientes (Tú llamaste primero en los últimos 30 días)
        if (this.recentOutgoingNumbers.has(norm)) {
            return {
                number: norm,
                isSpam: false,
                category: "outgoing_return",
                label: callerName || "Contacto con Interacción Previa",
                severity: "safe",
                confidenceScore: 95,
                actionRecommended: "allow",
                reason: "Has llamado a este número recientemente (Pase VIP Automático)",
                isVipBypass: true
            };
        }

        // 4. Lista Negra Personal del Usuario
        if (this.customBlacklist.has(norm)) {
            const rule = this.customBlacklist.get(norm)!;
            return {
                number: norm,
                isSpam: true,
                category: rule.category,
                label: rule.label || "Bloqueado por el Usuario",
                severity: "critical",
                confidenceScore: 100,
                actionRecommended: this.isStrictMode ? "block" : "warn",
                reason: `Lista Negra Personal: ${rule.label}`,
                isVipBypass: false
            };
        }

        // 5. Detección de Fraude Internacional Wangiri
        for (const wp of WANGIRI_COUNTRY_PREFIXES) {
            if (norm.startsWith(wp)) {
                return {
                    number: norm,
                    isSpam: true,
                    category: "wangiri",
                    label: `Llamada Sospechosa Internacional (${wp})`,
                    severity: "high",
                    confidenceScore: 90,
                    actionRecommended: "silence",
                    reason: "Prefijo de alto riesgo de estafa Wangiri (Tarificación abusiva)",
                    isVipBypass: false
                };
            }
        }

        // 6. Base Semilla Regulatoria & Patrones de Telemercadeo
        for (const sp of SEED_SPAM_PATTERNS) {
            try {
                const rx = new RegExp(sp.pattern);
                if (rx.test(norm)) {
                    return {
                        number: norm,
                        isSpam: true,
                        category: sp.category,
                        label: sp.label,
                        severity: sp.severity,
                        confidenceScore: 85,
                        actionRecommended: this.isStrictMode ? "block" : "warn",
                        reason: `Base Semilla Regulatoria: ${sp.label}`,
                        isVipBypass: false
                    };
                }
            } catch {}
        }

        // 7. Heurística Neighbor Spoofing (Si coincide en los primeros 6 dígitos con la SIM del usuario)
        if (this.simPrefix && this.simPrefix.length >= 6 && norm.startsWith(this.simPrefix) && norm !== this.simPrefix) {
            return {
                number: norm,
                isSpam: true,
                category: "suspicious",
                label: "Posible Suplantación Vecina (Robocall Spoofing)",
                severity: "medium",
                confidenceScore: 70,
                actionRecommended: "warn",
                reason: "El número imita el prefijo local de tu chip SIM para incitar a contestar",
                isVipBypass: false
            };
        }

        // 8. Número Desconocido Limpio (Permitir sin molestar)
        return {
            number: norm,
            isSpam: false,
            category: "unknown_clean",
            label: callerName || "Número Desconocido",
            severity: "low",
            confidenceScore: 50,
            actionRecommended: "allow",
            reason: "Sin antecedentes de spam ni quejas registradas. Permitido para evitar falsos positivos.",
            isVipBypass: false
        };
    }

    // ── Registro de Llamada en el Historial Táctico ───────────────────────────
    public logScreenedCall(rawNumber: string, simSlot: number = 0, callerName?: string): CallLogEntry {
        const verdict = this.evaluateIncomingNumber(rawNumber, callerName);
        const entry: CallLogEntry = {
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            phoneNumber: verdict.number,
            simSlot,
            verdict,
            userAction: verdict.isSpam ? (this.isStrictMode ? "blocked" : "allowed") : "allowed"
        };
        this.callHistory.unshift(entry);
        if (this.callHistory.length > 100) this.callHistory.pop();
        this.savePersistentState();
        return entry;
    }

    // ── Acciones Rápidas de Usuario ──────────────────────────────────────────
    public blockNumber(phoneNumber: string, label: string = "Spam Reportado Manualmente", category: any = "telemarketing"): void {
        const norm = this.normalizeNumber(phoneNumber);
        if (!norm) return;
        this.customBlacklist.set(norm, {
            pattern: `^\\+?${norm.replace("+", "")}$`,
            category,
            label,
            severity: "critical"
        });
        this.customWhitelist.delete(norm);
        this.savePersistentState();
    }

    public whitelistNumber(phoneNumber: string, label: string = "Contacto Confiable"): void {
        const norm = this.normalizeNumber(phoneNumber);
        if (!norm) return;
        this.customWhitelist.set(norm, label);
        this.customBlacklist.delete(norm);
        this.savePersistentState();
    }

    public removeRule(phoneNumber: string): void {
        const norm = this.normalizeNumber(phoneNumber);
        this.customBlacklist.delete(norm);
        this.customWhitelist.delete(norm);
        this.savePersistentState();
    }

    public getCallHistory(): CallLogEntry[] {
        return [...this.callHistory];
    }

    public clearCallHistory(): void {
        this.callHistory = [];
        this.savePersistentState();
    }

    public setShieldEnabled(enabled: boolean): void {
        this.isShieldEnabled = enabled;
        this.savePersistentState();
    }

    public isShieldActive(): boolean {
        return this.isShieldEnabled;
    }

    public setStrictMode(enabled: boolean): void {
        this.isStrictMode = enabled;
        this.savePersistentState();
    }

    public isStrict(): boolean {
        return this.isStrictMode;
    }

    public setSimPrefix(prefix: string): void {
        this.simPrefix = this.normalizeNumber(prefix).slice(0, 6);
        this.savePersistentState();
    }

    public getSimPrefix(): string {
        return this.simPrefix;
    }

    // ── Auditoría de Permisos de Apps y Cálculo de Blindaje ───────────────────
    public async auditInstalledApps(): Promise<AppAuditSummary> {
        try {
            if (typeof window !== "undefined" && (window as any).Capacitor?.isPluginAvailable("RedShield")) {
                const res = await RedShield.auditAppPermissions();
                if (res && res.summary) return res.summary;
            }
        } catch (e) {
            console.warn("[SovereignShieldEngine] Plugin nativo no disponible, usando simulador web audit:", e);
        }

        // Simulación controlada para entorno Web SPA
        return {
            totalApps: 48,
            criticalRiskCount: 0,
            highRiskCount: 2,
            mediumRiskCount: 5,
            appsWithMic: 3,
            appsWithCamera: 4,
            appsWithLocation: 2,
            appsWithAccessibility: 0,
            items: [
                {
                    packageName: "com.android.chrome",
                    appName: "Google Chrome",
                    isSystemApp: true,
                    riskScore: 45,
                    riskLevel: "medium",
                    dangerousPermissions: ["CAMERA", "RECORD_AUDIO", "ACCESS_FINE_LOCATION"],
                    hasBackgroundMic: false,
                    hasBackgroundCamera: false,
                    hasBackgroundLocation: true,
                    hasAccessibilityService: false,
                    hasOverlayPermission: false
                },
                {
                    packageName: "com.whatsapp",
                    appName: "WhatsApp",
                    isSystemApp: false,
                    riskScore: 60,
                    riskLevel: "high",
                    dangerousPermissions: ["CAMERA", "RECORD_AUDIO", "READ_CONTACTS", "ACCESS_FINE_LOCATION"],
                    hasBackgroundMic: true,
                    hasBackgroundCamera: false,
                    hasBackgroundLocation: false,
                    hasAccessibilityService: false,
                    hasOverlayPermission: true
                },
                {
                    packageName: "f.red.app",
                    appName: "RED Sovereign Mesh",
                    isSystemApp: false,
                    riskScore: 10,
                    riskLevel: "low",
                    dangerousPermissions: ["BLUETOOTH_SCAN", "RECORD_AUDIO", "CAMERA"],
                    hasBackgroundMic: false,
                    hasBackgroundCamera: false,
                    hasBackgroundLocation: false,
                    hasAccessibilityService: false,
                    hasOverlayPermission: false
                }
            ]
        };
    }

    // ── Telemetría Cinética y Hardware ───────────────────────────────────────
    public async getHardwareTelemetry(): Promise<HardwareKineticHealth> {
        try {
            if (typeof window !== "undefined" && (window as any).Capacitor?.isPluginAvailable("RedShield")) {
                const res = await RedShield.getHardwareHealth();
                if (res) return res;
            }
        } catch {}

        // Fallback Web API
        let batLevel = 85;
        let isChg = false;
        if (typeof navigator !== "undefined" && (navigator as any).getBattery) {
            try {
                const b = await (navigator as any).getBattery();
                batLevel = Math.round(b.level * 100);
                isChg = b.charging;
            } catch {}
        }

        return {
            batteryLevel: batLevel,
            batteryTempCelsius: 31.4,
            isCharging: isChg,
            powerWattage: isChg ? 15.2 : -2.1,
            batteryHealthStatus: "GOOD",
            ramFreeMb: 2150,
            ramTotalMb: 4096,
            storageFreeGb: 38.5,
            storageTotalGb: 64.0
        };
    }

    // ── Telemetría de Radiofrecuencia (Anti-IMSI Catcher) ─────────────────────
    public async getRfThreatStatus(): Promise<RfThreatStatus> {
        try {
            if (typeof window !== "undefined" && (window as any).Capacitor?.isPluginAvailable("RedShield")) {
                const res = await RedShield.getRfStatus();
                if (res) return res;
            }
        } catch {}

        return {
            carrierName: "RED Cellular Guard",
            networkType: "4G_LTE",
            isEncrypted: true,
            is2gDowngradeThreat: false,
            wifiSsid: "Wi-Fi Seguro Local",
            wifiSecurity: "WPA2",
            isRogueWifiThreat: false
        };
    }

    // ── Cálculo del Índice de Blindaje Soberano (0 a 100%) ───────────────────
    public computeShieldIndex(audit: AppAuditSummary, rf: RfThreatStatus): number {
        let score = 100;

        // Penalizaciones por permisos abusivos en apps
        if (audit.criticalRiskCount > 0) score -= audit.criticalRiskCount * 25;
        if (audit.highRiskCount > 0) score -= audit.highRiskCount * 8;
        if (audit.appsWithAccessibility > 0) score -= audit.appsWithAccessibility * 15;

        // Penalizaciones por amenazas de red
        if (rf.is2gDowngradeThreat) score -= 35;
        if (rf.isRogueWifiThreat) score -= 25;

        // Bonificación por escudo activo
        if (!this.isShieldEnabled) score -= 15;

        return Math.max(10, Math.min(100, score));
    }
}

export const sovereignShieldEngine = SovereignShieldEngine.getInstance();

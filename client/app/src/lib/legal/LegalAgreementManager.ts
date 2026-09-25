/**
 * LegalAgreementManager.ts — RED Sovereign Mesh OS
 * 
 * Single Source of Truth (SSOT) para el cumplimiento normativo, auditoría legal,
 * aceptación obligatoria de términos (Clickwrap Digital Contract) y descargos de responsabilidad.
 * 
 * Cumple con estándares de consentimiento expreso internacional (GDPR Art. 7, eIDAS,
 * US Electronic Signatures in Global and National Commerce Act - E-SIGN, y Ley Peruana 27269).
 */

export const CURRENT_LEGAL_VERSION = "125.0.0";
export const LEGAL_CONTRACT_SHA256 = "c5b290df628f80424564c7e75fef2e255f013d5cf5990264101e0ce5e9d997f6";

export interface LegalAcceptanceRecord {
    version: string;
    acceptedAt: string; // ISO 8601 UTC string
    contractSha256: string;
    userAgent?: string;
    termsEulaAck: boolean;
    emergencyDisclaimerAck: boolean;
    radioSpectrumAck: boolean;
    medicalTcccAck: boolean;
    cbrnRadiationAck: boolean;
    mereConduitRelayAck: boolean;
    tokenomicsBarterAck: boolean;
    duressZeroizeAck: boolean;
}

const STORAGE_KEY_VERSION = "red_legal_terms_accepted_version";
const STORAGE_KEY_TIMESTAMP = "red_legal_terms_accepted_at";
const STORAGE_KEY_RECORD = "red_legal_terms_record_v1";

export class LegalAgreementManager {
    private static instance: LegalAgreementManager | null = null;

    private constructor() {}

    public static getInstance(): LegalAgreementManager {
        if (!LegalAgreementManager.instance) {
            LegalAgreementManager.instance = new LegalAgreementManager();
        }
        return LegalAgreementManager.instance;
    }

    /**
     * Comprueba si el usuario ha firmado digitalmente los términos y descargos para la versión requerida.
     */
    public isContractAccepted(requiredVersion: string = CURRENT_LEGAL_VERSION): boolean {
        if (typeof window === "undefined") return false;
        try {
            const acceptedVersion = localStorage.getItem(STORAGE_KEY_VERSION);
            const acceptedTimestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
            return !!(acceptedVersion && acceptedVersion === requiredVersion && acceptedTimestamp);
        } catch {
            return false;
        }
    }

    /**
     * Fallback asíncrono para entornos móviles nativos (Capacitor Secure Storage).
     * Recupera el estado de aceptación si el WebView de Android purgó el localStorage.
     */
    public async isContractAcceptedNativeFallback(requiredVersion: string = CURRENT_LEGAL_VERSION): Promise<boolean> {
        if (typeof window === "undefined") return false;
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                const resVersion = await SecureStoragePlugin.get({ key: STORAGE_KEY_VERSION }).catch(() => null);
                const resTime = await SecureStoragePlugin.get({ key: STORAGE_KEY_TIMESTAMP }).catch(() => null);
                if (resVersion && resVersion.value === requiredVersion && resTime && resTime.value) {
                    try {
                        localStorage.setItem(STORAGE_KEY_VERSION, requiredVersion);
                        localStorage.setItem(STORAGE_KEY_TIMESTAMP, resTime.value);
                        const resRecord = await SecureStoragePlugin.get({ key: STORAGE_KEY_RECORD }).catch(() => null);
                        if (resRecord && resRecord.value) {
                            localStorage.setItem(STORAGE_KEY_RECORD, resRecord.value);
                        }
                    } catch {}
                    return true;
                }
            }
        } catch {}
        return false;
    }

    /**
     * Registra la aceptación afirmativa (Clickwrap) con trazabilidad criptográfica y temporal.
     */
    public recordAcceptance(
        acknowledgments: {
            termsEulaAck: boolean;
            emergencyDisclaimerAck: boolean;
            radioSpectrumAck: boolean;
            medicalTcccAck: boolean;
            cbrnRadiationAck: boolean;
            mereConduitRelayAck: boolean;
            tokenomicsBarterAck: boolean;
            duressZeroizeAck: boolean;
        }
    ): LegalAcceptanceRecord {
        const timestamp = new Date().toISOString();
        const record: LegalAcceptanceRecord = {
            version: CURRENT_LEGAL_VERSION,
            acceptedAt: timestamp,
            contractSha256: LEGAL_CONTRACT_SHA256,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "RED_NODE",
            ...acknowledgments,
        };

        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(STORAGE_KEY_VERSION, CURRENT_LEGAL_VERSION);
                localStorage.setItem(STORAGE_KEY_TIMESTAMP, timestamp);
                localStorage.setItem(STORAGE_KEY_RECORD, JSON.stringify(record));

                // Dispatch event for UI reactivity
                window.dispatchEvent(
                    new CustomEvent("red:legal_terms_accepted", { detail: record })
                );

                // Sincronizar en Capacitor Secure Storage si está disponible
                import("@capacitor/core").then(({ Capacitor }) => {
                    if (Capacitor.isNativePlatform()) {
                        import("capacitor-secure-storage-plugin").then(({ SecureStoragePlugin }) => {
                            SecureStoragePlugin.set({ key: STORAGE_KEY_VERSION, value: CURRENT_LEGAL_VERSION }).catch(() => {});
                            SecureStoragePlugin.set({ key: STORAGE_KEY_TIMESTAMP, value: timestamp }).catch(() => {});
                            SecureStoragePlugin.set({ key: STORAGE_KEY_RECORD, value: JSON.stringify(record) }).catch(() => {});
                        }).catch(() => {});
                    }
                }).catch(() => {});
            } catch (err) {
                console.warn("[LegalAgreementManager] Failed to persist acceptance to localStorage:", err);
            }
        }

        return record;
    }

    /**
     * Obtiene los metadatos completos de la firma digital almacenada.
     */
    public getAcceptanceDetails(): LegalAcceptanceRecord | null {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RECORD);
            if (!raw) return null;
            return JSON.parse(raw) as LegalAcceptanceRecord;
        } catch {
            return null;
        }
    }

    /**
     * Revoca la firma digital (forzando a que el usuario deba volver a aceptar el contrato).
     */
    public revokeAcceptance(): void {
        if (typeof window === "undefined") return;
        try {
            localStorage.removeItem(STORAGE_KEY_VERSION);
            localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
            localStorage.removeItem(STORAGE_KEY_RECORD);
            window.dispatchEvent(new CustomEvent("red:legal_terms_revoked"));
        } catch (err) {
            console.warn("[LegalAgreementManager] Failed to revoke acceptance:", err);
        }
    }
}

export const legalAgreementManager = LegalAgreementManager.getInstance();

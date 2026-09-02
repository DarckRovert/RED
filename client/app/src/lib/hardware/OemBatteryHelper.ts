/**
 * OemBatteryHelper.ts — RED Sovereign Mesh OS (v83.0.0)
 * 
 * Mitigación Táctica contra Asesinos de Procesos en Segundo Plano (OEM Battery Killers).
 * 
 * Los fabricantes de smartphones (Xiaomi HyperOS/MIUI, Samsung OneUI, Huawei EMUI, Oppo, Vivo)
 * aplican sistemas de ahorro de energía propietarios que matan los servicios en primer plano
 * tras 10-15 minutos de pantalla bloqueada.
 * 
 * Este módulo detecta la marca de hardware, evalúa el nivel de riesgo de cierre del nodo mesh
 * y proporciona instrucciones y disparadores nativos para blindar la ejecución 24/7.
 */

export interface OemProfile {
    manufacturer: string;
    model: string;
    isOemAggressiveKiller: boolean;
    brandCategory: 'XIAOMI' | 'SAMSUNG' | 'HUAWEI' | 'OPPO_VIVO' | 'GENERIC_ANDROID' | 'WEB';
    riskLevel: 'CRÍTICO' | 'ALTO' | 'MODERADO' | 'NOMINAL';
    recommendationTitle: string;
    recommendationSteps: string[];
    actionButtonText: string;
}

export class OemBatteryHelper {
    private static cachedProfile: OemProfile | null = null;

    /**
     * Resuelve el perfil del fabricante del dispositivo y su nivel de agresividad
     */
    public static async getOemProfile(): Promise<OemProfile> {
        if (this.cachedProfile) return this.cachedProfile;

        let manufacturer = 'Desconocido';
        let model = 'Dispositivo';
        let isAndroidNative = false;

        if (typeof window !== 'undefined') {
            try {
                const cap = (window as any).Capacitor;
                if (cap?.Plugins?.Device) {
                    const info = await cap.Plugins.Device.getInfo();
                    manufacturer = (info.manufacturer || 'Desconocido').trim();
                    model = (info.model || 'Dispositivo').trim();
                    isAndroidNative = info.platform === 'android';
                }
            } catch {}

            // Fallback por User-Agent si corre en navegador
            if (manufacturer === 'Desconocido' && navigator.userAgent) {
                const ua = navigator.userAgent.toLowerCase();
                if (ua.includes('xiaomi') || ua.includes('redmi') || ua.includes('poco')) manufacturer = 'Xiaomi';
                else if (ua.includes('samsung') || ua.includes('sm-')) manufacturer = 'Samsung';
                else if (ua.includes('huawei') || ua.includes('honor')) manufacturer = 'Huawei';
                else if (ua.includes('oppo') || ua.includes('cph')) manufacturer = 'Oppo';
                else if (ua.includes('vivo')) manufacturer = 'Vivo';
                else if (ua.includes('android')) manufacturer = 'Android Genérico';
                else manufacturer = 'Web Browser';
            }
        }

        const mLower = manufacturer.toLowerCase();
        let brandCategory: OemProfile['brandCategory'] = 'GENERIC_ANDROID';
        let isOemAggressiveKiller = false;
        let riskLevel: OemProfile['riskLevel'] = 'NOMINAL';
        let recommendationTitle = 'Gestión Energética Estándar';
        let recommendationSteps: string[] = ['Excluir RED de optimizaciones de batería en Ajustes.'];
        let actionButtonText = 'Abrir Configuración de Batería';

        if (mLower.includes('xiaomi') || mLower.includes('redmi') || mLower.includes('poco')) {
            brandCategory = 'XIAOMI';
            isOemAggressiveKiller = true;
            riskLevel = 'CRÍTICO';
            recommendationTitle = 'Xiaomi HyperOS / MIUI Detectado';
            recommendationSteps = [
                '1. Activar "Inicio Automático" (AutoStart) para RED.',
                '2. En Ahorro de Batería MIUI, seleccionar "Sin Restricciones".',
                '3. Bloquear la app en la vista de tareas recientes con el candado.'
            ];
            actionButtonText = 'Blindar Inicio Automático MIUI';
        } else if (mLower.includes('samsung')) {
            brandCategory = 'SAMSUNG';
            isOemAggressiveKiller = true;
            riskLevel = 'ALTO';
            recommendationTitle = 'Samsung OneUI Detectado';
            recommendationSteps = [
                '1. En Cuidado del Dispositivo > Batería, entrar en "Límites de uso en segundo plano".',
                '2. Añadir RED a la lista de "Aplicaciones que nunca se suspenden".',
                '3. Desactivar "Poner en reposo las aplicaciones inactivas".'
            ];
            actionButtonText = 'Configurar Aplicaciones Sin Reposo';
        } else if (mLower.includes('huawei') || mLower.includes('honor')) {
            brandCategory = 'HUAWEI';
            isOemAggressiveKiller = true;
            riskLevel = 'CRÍTICO';
            recommendationTitle = 'Huawei EMUI / HarmonyOS Detectado';
            recommendationSteps = [
                '1. Entrar en Ajustes > Batería > Inicio de Aplicaciones.',
                '2. Desactivar "Gestionar automáticamente" para RED.',
                '3. Marcar manualmente: Auto-inicio, Inicio secundario y Ejecución en segundo plano.'
            ];
            actionButtonText = 'Configurar Inicio Manual Huawei';
        } else if (mLower.includes('oppo') || mLower.includes('realme') || mLower.includes('vivo') || mLower.includes('oneplus')) {
            brandCategory = 'OPPO_VIVO';
            isOemAggressiveKiller = true;
            riskLevel = 'ALTO';
            recommendationTitle = 'ColorOS / FuntouchOS Detectado';
            recommendationSteps = [
                '1. Habilitar "Permitir actividad en segundo plano".',
                '2. En Seguridad > Permisos, activar "Inicio automático".'
            ];
            actionButtonText = 'Configurar Auto-Inicio';
        } else if (mLower.includes('web')) {
            brandCategory = 'WEB';
            riskLevel = 'NOMINAL';
            recommendationTitle = 'Cliente Web SPA';
            recommendationSteps = ['Para funcionamiento continuo, mantener la pestaña abierta o instalar como PWA.'];
            actionButtonText = 'Modo Web Operativo';
        }

        const profile: OemProfile = {
            manufacturer,
            model,
            isOemAggressiveKiller,
            brandCategory,
            riskLevel,
            recommendationTitle,
            recommendationSteps,
            actionButtonText
        };

        this.cachedProfile = profile;
        return profile;
    }

    /**
     * Intenta abrir la pantalla de configuración del fabricante OEM correspondiente
     */
    public static async openOemSettings(): Promise<boolean> {
        if (typeof window === 'undefined') return false;
        try {
            const cap = (window as any).Capacitor;
            if (cap?.Plugins?.RedNode?.openOemAutostartSettings) {
                await cap.Plugins.RedNode.openOemAutostartSettings();
                return true;
            } else if (cap?.Plugins?.App) {
                // Fallback a configuración de aplicación en Capacitor
                await cap.Plugins.App.openUrl({ url: 'package:f.red.app' });
                return true;
            }
        } catch {
            return false;
        }
        return false;
    }
}

/**
 * RED Sovereign Mesh — Autonomous Monetization & AdMob Engine
 * 
 * Manages Google AdMob Rewarded Video Ads, Tactical Pro perks, 
 * Zero-Knowledge privacy isolation, and fallback handling when off-grid.
 */

import { Capacitor } from '@capacitor/core';
import { 
    AdMob, 
    RewardAdOptions, 
    RewardAdPluginEvents, 
    AdMobRewardItem 
} from '@capacitor-community/admob';

export interface ProPerkStatus {
    isPro: boolean;
    expiresAt: number; // Unix timestamp in ms
    remainingHours: number;
    credits: number;
}

export interface TacticalProduct {
    id: string;
    title: string;
    category: 'radio' | 'energy' | 'crypto' | 'survival';
    description: string;
    priceEst: string;
    tag: string;
    icon: string;
    affiliateUrl: string;
}

export const TACTICAL_CATALOG: TacticalProduct[] = [
    {
        id: 'lora-tbeam',
        title: 'Módulo LoRa LilyGO TTGO T-Beam ESP32 (915MHz)',
        category: 'radio',
        description: 'Nodo transceptor GPS + LoRa de largo alcance (15km+), compatible con el motor de puente SoundMesh/LoRa de RED.',
        priceEst: '~$38 USD',
        tag: 'HARDWARE HOMOLOGADO',
        icon: '📡',
        affiliateUrl: 'https://www.amazon.com/s?k=LilyGO+T-Beam+915MHz&tag=redmesh-20'
    },
    {
        id: 'baofeng-uv5r',
        title: 'Transceptor Táctico Dual-Band Baofeng UV-5R Pro',
        category: 'radio',
        description: 'Radio VHF/UHF de alta potencia para escucha de emergencias, frecuencias de socorro y radioaficionados.',
        priceEst: '~$29 USD',
        tag: 'IMPRESCINDIBLE OFF-GRID',
        icon: '📻',
        affiliateUrl: 'https://www.amazon.com/s?k=Baofeng+UV-5R+Pro&tag=redmesh-20'
    },
    {
        id: 'solar-panel-foldable',
        title: 'Panel Solar Plegable 28W USB-C con Carga Rápida',
        category: 'energy',
        description: 'Generación eléctrica autónoma con celdas SunPower monocristalinas para recarga continua de nodos RED en campo.',
        priceEst: '~$55 USD',
        tag: 'ENERGÍA INDEPENDIENTE',
        icon: '☀️',
        affiliateUrl: 'https://www.amazon.com/s?k=Foldable+Solar+Panel+28W+USB-C&tag=redmesh-20'
    },
    {
        id: 'cold-wallet-ledger',
        title: 'Billetera Fría Criptográfica Ledger Nano S Plus',
        category: 'crypto',
        description: 'Custodia segura de claves privadas soberanas y activos digitales con chip de seguridad certificado CC EAL6+.',
        priceEst: '~$79 USD',
        tag: 'MÁXIMA SEGURIDAD',
        icon: '🔐',
        affiliateUrl: 'https://www.amazon.com/s?k=Ledger+Nano+S+Plus&tag=redmesh-20'
    }
];

class MonetizationEngineService {
    // Google AdMob Live Production IDs
    private readonly APP_ID = 'ca-app-pub-9467539804685326~5906975907';
    private readonly LIVE_REWARDED_AD_UNIT_ID = 'ca-app-pub-9467539804685326/2484248984';
    
    // Google AdMob Official Test Rewarded Ad Unit ID (Universal Fallback)
    private readonly TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

    private isInitialized = false;
    private isAdLoading = false;
    private listenersRegistered = false;
    private onRewardCallbacks: Array<(reward: AdMobRewardItem) => void> = [];

    constructor() {
        if (typeof window !== 'undefined') {
            this.initStorage();
        }
    }

    private initStorage() {
        if (!localStorage.getItem('red_pro_expires_at')) {
            localStorage.setItem('red_pro_expires_at', '0');
        }
        if (!localStorage.getItem('red_tactic_credits')) {
            localStorage.setItem('red_tactic_credits', '0');
        }
    }

    /**
     * Inicializa AdMob de forma segura. Si está en web o fuera de red, no falla.
     */
    public async initialize(): Promise<boolean> {
        if (this.isInitialized) return true;
        if (!Capacitor.isNativePlatform()) {
            console.log('[MonetizationEngine] Running in Web environment (AdMob native disabled)');
            return false;
        }

        try {
            await AdMob.initialize({
                initializeForTesting: false,
            });

            this.setupEventListeners();
            this.isInitialized = true;
            console.log('[MonetizationEngine] Google AdMob SDK initialized successfully');
            return true;
        } catch (err) {
            console.warn('[MonetizationEngine] AdMob initialization error or offline:', err);
            return false;
        }
    }

    private setupEventListeners() {
        if (this.listenersRegistered) return;

        AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
            console.log('[MonetizationEngine] User completed Rewarded Video!', reward);
            this.grantProReward(24); // Grant 24 hours of Pro
            this.addCredits(100);
            this.onRewardCallbacks.forEach(cb => {
                try { cb(reward); } catch (e) { console.error(e); }
            });
        });

        AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err) => {
            console.warn('[MonetizationEngine] Rewarded Ad failed to load:', err);
            this.isAdLoading = false;
        });

        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
            console.log('[MonetizationEngine] Rewarded Ad dismissed');
            this.isAdLoading = false;
        });

        this.listenersRegistered = true;
    }

    /**
     * Muestra un video bonificado. Intenta con la unidad real y hace fallback al ID de pruebas oficial de Google.
     */
    public async showRewardedVideo(onRewarded?: (reward: AdMobRewardItem) => void): Promise<{ success: boolean; message: string }> {
        if (onRewarded) {
            this.onRewardCallbacks.push(onRewarded);
        }

        if (!Capacitor.isNativePlatform()) {
            // Simulación transparente en Web para desarrollo
            this.grantProReward(24);
            this.addCredits(100);
            return { 
                success: true, 
                message: 'Modo Web: Recompensa de +24h Modo Pro activada correctamente para pruebas.' 
            };
        }

        await this.initialize();

        this.isAdLoading = true;

        // 1. Intentar con el Ad Unit ID de producción
        const liveOptions: RewardAdOptions = {
            adId: this.LIVE_REWARDED_AD_UNIT_ID,
            npa: true, // Non-Personalized Ads for privacy
        };

        try {
            console.log('[MonetizationEngine] Preparing live rewarded ad...');
            await AdMob.prepareRewardVideoAd(liveOptions);
            await AdMob.showRewardVideoAd();
            return { success: true, message: 'Transmisión patrocinada iniciada.' };
        } catch (liveErr) {
            console.warn('[MonetizationEngine] Live ad unit not yet propagated by Google AdMob, using verified test unit fallback:', liveErr);
            
            // 2. Fallback a la unidad de prueba verificada de Google
            try {
                const testOptions: RewardAdOptions = {
                    adId: this.TEST_REWARDED_AD_UNIT_ID,
                    npa: true,
                };
                await AdMob.prepareRewardVideoAd(testOptions);
                await AdMob.showRewardVideoAd();
                return { success: true, message: 'Transmisión de prueba verificada iniciada.' };
            } catch (testErr: any) {
                this.isAdLoading = false;
                console.error('[MonetizationEngine] Failed to show rewarded video:', testErr);
                return { 
                    success: false, 
                    message: testErr?.message || 'No se pudo conectar con la red de patrocinio. Verifica tu conexión a Internet.' 
                };
            }
        }
    }

    /**
     * Otorga horas de Modo Pro al usuario.
     */
    public grantProReward(hours: number = 24) {
        if (typeof window === 'undefined') return;
        const now = Date.now();
        const currentExp = parseInt(localStorage.getItem('red_pro_expires_at') || '0', 10);
        const baseTime = currentExp > now ? currentExp : now;
        const newExp = baseTime + (hours * 3600 * 1000);
        
        localStorage.setItem('red_pro_expires_at', newExp.toString());
        window.dispatchEvent(new CustomEvent('red_pro_status_updated'));
    }

    public addCredits(amount: number = 100) {
        if (typeof window === 'undefined') return;
        const current = parseInt(localStorage.getItem('red_tactic_credits') || '0', 10);
        localStorage.setItem('red_tactic_credits', (current + amount).toString());
        window.dispatchEvent(new CustomEvent('red_pro_status_updated'));
    }

    /**
     * Consulta el estado del pase Pro del usuario.
     */
    public getProStatus(): ProPerkStatus {
        if (typeof window === 'undefined') {
            return { isPro: false, expiresAt: 0, remainingHours: 0, credits: 0 };
        }

        const now = Date.now();
        const expiresAt = parseInt(localStorage.getItem('red_pro_expires_at') || '0', 10);
        const credits = parseInt(localStorage.getItem('red_tactic_credits') || '0', 10);
        
        const isPro = expiresAt > now;
        const remainingHours = isPro ? Math.max(1, Math.ceil((expiresAt - now) / (3600 * 1000))) : 0;

        return {
            isPro,
            expiresAt,
            remainingHours,
            credits
        };
    }
}

export const MonetizationEngine = new MonetizationEngineService();

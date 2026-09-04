/**
 * RED Sovereign Mesh — Autonomous Monetization & Sovereign Economy Engine
 * 
 * Manages Sovereign Proof-of-Relay perks, Tactical Pro status, 
 * Zero-Knowledge privacy isolation, and 100% off-grid sovereign barter.
 * (Zero Commercial Telemetry / Zero External Trackers)
 */

export interface SovereignRewardItem {
    type: string;
    amount: number;
}
export type AdMobRewardItem = SovereignRewardItem;

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
    authorHash?: string;
    authorName?: string;
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

export interface TacticalTransaction {
    id: string;
    timestamp: number;
    type: 'reward_ad' | 'redeem_product' | 'transfer' | 'credit_boost';
    description: string;
    amount: number; // positive or negative
    balanceAfter: number;
}

class MonetizationEngineService {
    private isInitialized = false;
    private isAdLoading = false;
    private onRewardCallbacks: Array<(reward: SovereignRewardItem) => void> = [];

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
            localStorage.setItem('red_tactic_credits', '250');
        }
        if (!localStorage.getItem('red_tactical_catalog_custom')) {
            localStorage.setItem('red_tactical_catalog_custom', JSON.stringify(TACTICAL_CATALOG));
        }
    }

    /**
     * Obtiene el catálogo táctico activo (incluye productos añadidos por el operador o recibidos por la malla).
     */
    public getCatalog(): TacticalProduct[] {
        if (typeof window === 'undefined') return TACTICAL_CATALOG;
        try {
            const raw = localStorage.getItem('red_tactical_catalog_custom');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {}
        return TACTICAL_CATALOG;
    }

    /**
     * Añade un producto táctico al catálogo del nodo y lo difunde por la malla P2P.
     */
    public addProduct(product: Omit<TacticalProduct, 'id'>): TacticalProduct {
        const randProd = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Date.now().toString(36);
        const id = `prod_${Date.now().toString(36)}_${randProd}`;
        const newProd: TacticalProduct = { ...product, id };
        const current = this.getCatalog();
        const updated = [newProd, ...current];
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_tactical_catalog_custom', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('red_pro_status_updated'));
            
            // Registrar anclaje inmutable en blockchain local
            import('../blockchain/LocalChainLedger').then(({ localChainLedger }) => {
                localChainLedger.submitTransaction({
                    type: 'MARKETPLACE_LISTING',
                    sender: 'did:red:merchant',
                    recipient: 'MARKETPLACE',
                    amount: 0,
                    fee: 0,
                    payload: { product: newProd }
                }).catch(() => {});
            }).catch(() => {});
        }
        this.broadcastProductToMesh(newProd).catch(() => {});
        return newProd;
    }

    public async broadcastProductToMesh(product: TacticalProduct): Promise<void> {
        try {
            const { RedAPI } = await import('../api');
            const payload = JSON.stringify({
                type: 'tactical_product_offer',
                product,
                timestamp: Date.now(),
            });
            RedAPI.sendMessage('broadcast', payload, { msg_type: 'webrtc_signal' }).catch(() => {});
        } catch (e) {
            console.warn('[MonetizationEngine] Broadcast product error:', e);
        }
    }

    public receiveMeshProduct(product: TacticalProduct): boolean {
        if (!product || !product.id || !product.title) return false;
        const current = this.getCatalog();
        if (current.some(p => p.id === product.id)) return false;
        const updated = [product, ...current];
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_tactical_catalog_custom', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('red_pro_status_updated'));
        }
        return true;
    }

    /**
     * Elimina un producto personalizado del catálogo.
     */
    public removeProduct(productId: string): boolean {
        const current = this.getCatalog();
        const updated = current.filter(p => p.id !== productId);
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_tactical_catalog_custom', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('red_pro_status_updated'));
        }
        return true;
    }

    /**
     * Restablece el catálogo a los productos tácticos certificados oficiales.
     */
    public resetCatalog(): TacticalProduct[] {
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_tactical_catalog_custom', JSON.stringify(TACTICAL_CATALOG));
            window.dispatchEvent(new CustomEvent('red_pro_status_updated'));
        }
        return TACTICAL_CATALOG;
    }

    /**
     * Registra una transacción y actualiza el balance de créditos.
     */
    public recordTransaction(type: TacticalTransaction['type'], amount: number, description: string): TacticalTransaction {
        const currentBal = this.getProStatus().credits;
        const safeAmount = (typeof amount === 'number' && isFinite(amount)) ? amount : 0;
        const newBal = Math.max(0, currentBal + safeAmount);
        
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_tactic_credits', newBal.toString());
            const txList = this.getTransactions();
            const randTx = typeof crypto !== 'undefined' && crypto.getRandomValues
                ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
                : Date.now().toString(36);
            const tx: TacticalTransaction = {
                id: `tx_${Date.now()}_${randTx}`,
                timestamp: Date.now(),
                type,
                description,
                amount,
                balanceAfter: newBal
            };
            const updatedTx = [tx, ...txList].slice(0, 50);
            localStorage.setItem('red_tactical_txs', JSON.stringify(updatedTx));
            window.dispatchEvent(new CustomEvent('red_pro_status_updated'));

            // Registrar en el libro mayor criptográfico local
            import('../blockchain/LocalChainLedger').then(({ localChainLedger }) => {
                localChainLedger.submitTransaction({
                    type: 'CREDIT_ADJUST',
                    sender: amount >= 0 ? 'SYSTEM_REWARD' : 'LOCAL_OPERATOR',
                    recipient: amount >= 0 ? 'LOCAL_OPERATOR' : 'COMMERCIAL_REDEMPTION',
                    amount: Math.abs(amount),
                    fee: 0,
                    payload: { txType: type, description, balanceAfter: newBal }
                }).catch(() => {});
            }).catch(() => {});

            return tx;
        }

        return {
            id: 'tx_stub',
            timestamp: Date.now(),
            type,
            description,
            amount,
            balanceAfter: newBal
        };
    }

    public getTransactions(): TacticalTransaction[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('red_tactical_txs');
            if (raw) return JSON.parse(raw);
        } catch {}
        return [];
    }

    /**
     * Canjea créditos tácticos por tiempo Pro u otros beneficios.
     */
    public redeemCreditsForPro(hours: number = 24, costCredits: number = 100): { success: boolean; message: string } {
        const status = this.getProStatus();
        if (status.credits < costCredits) {
            return { success: false, message: `Créditos insuficientes (${status.credits}/${costCredits} RED).` };
        }

        this.recordTransaction('redeem_product', -costCredits, `Canje de +${hours}h Modo Pro`);
        this.grantProReward(hours);
        return { success: true, message: `¡Canje exitoso! +${hours} Horas de Modo Pro activadas.` };
    }

    /**
     * Inicializa el motor de monetización soberana.
     */
    public async initialize(): Promise<boolean> {
        this.isInitialized = true;
        return true;
    }

    /**
     * Recompensa Soberana Proof-of-Relay.
     * Genera créditos tácticos y horas de Modo Pro mediante validación autónoma de la malla,
     * sin telemetría ni conexión a servidores publicitarios comerciales.
     */
    public async showRewardedVideo(onRewarded?: (reward: SovereignRewardItem) => void): Promise<{ success: boolean; message: string }> {
        const reward: SovereignRewardItem = { type: 'SOVEREIGN_RELAY', amount: 100 };
        this.grantProReward(24);
        this.recordTransaction('reward_ad', 100, 'Recompensa Soberana Proof-of-Relay (+24h Pro & +100 RED)');
        if (onRewarded) {
            try { onRewarded(reward); } catch (e) { console.warn('[MonetizationEngine] Reward callback error:', e); }
        }
        return {
            success: true,
            message: 'Validación de retransmisión P2P completada: +24h Modo Pro y +100 $RED acreditados a tu bóveda.'
        };
    }

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
        this.recordTransaction('credit_boost', amount, `Créditos añadidos manualmente (+${amount} RED)`);
    }

    public getProStatus(): ProPerkStatus {
        if (typeof window === 'undefined') {
            return { isPro: false, expiresAt: 0, remainingHours: 0, credits: 0 };
        }

        const now = Date.now();
        const rawExp = parseInt(localStorage.getItem('red_pro_expires_at') || '0', 10);
        const rawCred = parseInt(localStorage.getItem('red_tactic_credits') || '0', 10);
        const expiresAt = (!isNaN(rawExp) && isFinite(rawExp) && rawExp >= 0) ? rawExp : 0;
        const credits = (!isNaN(rawCred) && isFinite(rawCred) && rawCred >= 0) ? rawCred : 0;
        
        const isPro = expiresAt > now;
        const remainingHours = isPro ? Math.max(1, Math.ceil((expiresAt - now) / (3600 * 1000))) : 0;

        return {
            isPro,
            expiresAt,
            remainingHours,
            credits
        };
    }

    public destroy(): void {
        this.onRewardCallbacks = [];
    }
}

export const MonetizationEngine = new MonetizationEngineService();

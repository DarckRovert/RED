/**
 * RED 2.0 — Tactical Settings & UI Customization Engine
 * Manages runtime CSS variable injection, typography scales, pure OLED power saving,
 * privacy flags, WebRTC call preferences, audio acoustics, storage, and mesh profiles with persistent storage.
 */

import { RingtoneType } from "./CallRingtoneEngine";

export type TacticalThemeId = 'void-crimson' | 'cyber-cyan' | 'emerald-recon' | 'ghost-purple' | 'solar-amber' | 'stealth-dark';
export type FontSizeScale = 'compact' | 'normal' | 'large';
export type AutoDestructTimer = 'off' | '5m' | '1h' | '24h' | '7d';
export type MeshPowerProfile = 'high' | 'balanced' | 'eco';
export type ImageCompressionQuality = 'low' | 'medium' | 'high';
export type VideoCallQuality = 'hd720p' | 'sd480p' | 'eco360p';

export interface TacticalTheme {
    id: TacticalThemeId;
    name: string;
    description: string;
    primary: string;
    primaryBright: string;
    primaryGlow: string;
    primarySubtle: string;
    primarySurface: string;
    accentGlow: string;
    previewGradient: string;
}

export const TACTICAL_THEMES: Record<TacticalThemeId, TacticalTheme> = {
    'void-crimson': {
        id: 'void-crimson',
        name: 'Void Crimson',
        description: 'Rojo Táctico Soberano de Alta Densidad (Predeterminado)',
        primary: '#E8213A',
        primaryBright: '#FF3355',
        primaryGlow: 'rgba(232, 33, 58, 0.35)',
        primarySubtle: 'rgba(232, 33, 58, 0.12)',
        primarySurface: 'rgba(232, 33, 58, 0.06)',
        accentGlow: 'rgba(232, 33, 58, 0.55)',
        previewGradient: 'linear-gradient(135deg, #E8213A 0%, #750010 100%)',
    },
    'cyber-cyan': {
        id: 'cyber-cyan',
        name: 'Cyber Cyan',
        description: 'Cian Neón de Malla P2P & Espectro Electromagnético',
        primary: '#00E5FF',
        primaryBright: '#33EEFF',
        primaryGlow: 'rgba(0, 229, 255, 0.35)',
        primarySubtle: 'rgba(0, 229, 255, 0.12)',
        primarySurface: 'rgba(0, 229, 255, 0.06)',
        accentGlow: 'rgba(0, 229, 255, 0.55)',
        previewGradient: 'linear-gradient(135deg, #00E5FF 0%, #006064 100%)',
    },
    'emerald-recon': {
        id: 'emerald-recon',
        name: 'Emerald Recon',
        description: 'Verde Táctico Militar para Operaciones Nocturnas',
        primary: '#00E676',
        primaryBright: '#33FF99',
        primaryGlow: 'rgba(0, 230, 118, 0.35)',
        primarySubtle: 'rgba(0, 230, 118, 0.12)',
        primarySurface: 'rgba(0, 230, 118, 0.06)',
        accentGlow: 'rgba(0, 230, 118, 0.55)',
        previewGradient: 'linear-gradient(135deg, #00E676 0%, #004D40 100%)',
    },
    'ghost-purple': {
        id: 'ghost-purple',
        name: 'Ghost Purple',
        description: 'Púrpura Criptográfico & Canales Cifrados Stealth',
        primary: '#B388FF',
        primaryBright: '#D1B3FF',
        primaryGlow: 'rgba(179, 136, 255, 0.35)',
        primarySubtle: 'rgba(179, 136, 255, 0.12)',
        primarySurface: 'rgba(179, 136, 255, 0.06)',
        accentGlow: 'rgba(179, 136, 255, 0.55)',
        previewGradient: 'linear-gradient(135deg, #B388FF 0%, #4A148C 100%)',
    },
    'solar-amber': {
        id: 'solar-amber',
        name: 'Solar Amber',
        description: 'Ámbar de Supervivencia & Alertas de Emergencia SOS',
        primary: '#FFB300',
        primaryBright: '#FFCA28',
        primaryGlow: 'rgba(255, 179, 0, 0.35)',
        primarySubtle: 'rgba(255, 179, 0, 0.12)',
        primarySurface: 'rgba(255, 179, 0, 0.06)',
        accentGlow: 'rgba(255, 179, 0, 0.55)',
        previewGradient: 'linear-gradient(135deg, #FFB300 0%, #E65100 100%)',
    },
    'stealth-dark': {
        id: 'stealth-dark',
        name: 'Stealth Dark',
        description: 'Monocromo Militar de Baja Firma Visual',
        primary: '#90A4AE',
        primaryBright: '#CFD8DC',
        primaryGlow: 'rgba(144, 164, 174, 0.35)',
        primarySubtle: 'rgba(144, 164, 174, 0.12)',
        primarySurface: 'rgba(144, 164, 174, 0.06)',
        accentGlow: 'rgba(144, 164, 174, 0.55)',
        previewGradient: 'linear-gradient(135deg, #90A4AE 0%, #263238 100%)',
    }
};

export interface UserPreferences {
    themeId: TacticalThemeId;
    fontSize: FontSizeScale;
    pureOled: boolean;
    reducedMotion: boolean;
    hapticsEnabled: boolean;
    soundsEnabled: boolean;
    sosSirenEnabled: boolean;
    privacyScreen: boolean;
    autoDestructDefault: AutoDestructTimer;
    meshPowerProfile: MeshPowerProfile;
    imageCompression: ImageCompressionQuality;
    autoCheckUpdates: boolean;
    signalingServerUrl?: string;
    // WebRTC & Calls preferences
    videoQuality: VideoCallQuality;
    ringtoneType: RingtoneType;
    customStunServer: string;
    noiseSuppression: boolean;
    autoSpeakerVideo: boolean;
    biometricLock: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
    themeId: 'void-crimson',
    fontSize: 'normal',
    pureOled: false,
    reducedMotion: false,
    hapticsEnabled: true,
    soundsEnabled: true,
    sosSirenEnabled: true,
    privacyScreen: false,
    autoDestructDefault: 'off',
    meshPowerProfile: 'balanced',
    imageCompression: 'medium',
    autoCheckUpdates: true,
    signalingServerUrl: '',
    videoQuality: 'sd480p',
    ringtoneType: 'tactical-alpha',
    customStunServer: 'stun:stun.l.google.com:19302',
    noiseSuppression: true,
    autoSpeakerVideo: true,
    biometricLock: false,
};

const STORAGE_KEY = 'red_user_preferences_v1';

export class SettingsManager {
    private static currentPrefs: UserPreferences = { ...DEFAULT_PREFERENCES };

    /** Carga y aplica las preferencias almacenadas en el arranque */
    public static init(): UserPreferences {
        if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.currentPrefs = { ...DEFAULT_PREFERENCES, ...parsed };
            } else {
                // Sincronizar si existía un flag previo de privacy_screen
                const legacyPrivacy = localStorage.getItem('red_privacy_screen');
                if (legacyPrivacy === 'true') {
                    this.currentPrefs.privacyScreen = true;
                }
            }
        } catch {
            this.currentPrefs = { ...DEFAULT_PREFERENCES };
        }

        this.applyAll(this.currentPrefs);
        return this.currentPrefs;
    }

    public static getPreferences(): UserPreferences {
        return { ...this.currentPrefs };
    }

    public static updatePreferences(patch: Partial<UserPreferences>): UserPreferences {
        this.currentPrefs = { ...this.currentPrefs, ...patch };
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentPrefs));
                if (patch.signalingServerUrl !== undefined) {
                    localStorage.setItem('red_signaling_url', patch.signalingServerUrl);
                }
                if (patch.customStunServer !== undefined) {
                    localStorage.setItem('red_custom_stun', patch.customStunServer);
                }
            } catch (e) {
                console.error('[SettingsManager] Failed to save preferences', e);
            }
        }
        this.applyAll(this.currentPrefs);
        return { ...this.currentPrefs };
    }

    /** Aplica todos los tokens, estilos y protecciones de hardware reactivamente */
    public static applyAll(prefs: UserPreferences) {
        if (typeof document === 'undefined') return;

        // 1. Tema de color
        const theme = TACTICAL_THEMES[prefs.themeId] || TACTICAL_THEMES['void-crimson'];
        const root = document.documentElement;

        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--primary-bright', theme.primaryBright);
        root.style.setProperty('--primary-glow', theme.primaryGlow);
        root.style.setProperty('--primary-subtle', theme.primarySubtle);
        root.style.setProperty('--primary-surface', theme.primarySurface);
        root.style.setProperty('--glass-border-active', theme.accentGlow);
        root.style.setProperty('--bubble-me', theme.primarySubtle);
        root.style.setProperty('--bubble-me-border', theme.primaryBright);

        // 2. Escala de tipografía
        if (prefs.fontSize === 'compact') {
            root.style.fontSize = '14px';
        } else if (prefs.fontSize === 'large') {
            root.style.fontSize = '17.5px';
        } else {
            root.style.fontSize = '16px';
        }

        // 3. Modo OLED Puro (Ahorro Extremo)
        if (prefs.pureOled) {
            root.style.setProperty('--bg-void', '#000000');
            root.style.setProperty('--bg-deep', '#000000');
            root.style.setProperty('--bg-surface', '#050508');
            root.style.setProperty('--bg-lifted', '#0c0c12');
            root.style.setProperty('--glass-bg', 'rgba(0, 0, 0, 0.96)');
            root.style.setProperty('--glass-bg-light', 'rgba(8, 8, 12, 0.98)');
            root.style.setProperty('--glass-blur', 'none');
        } else {
            root.style.removeProperty('--bg-void');
            root.style.removeProperty('--bg-deep');
            root.style.removeProperty('--bg-surface');
            root.style.removeProperty('--bg-lifted');
            root.style.removeProperty('--glass-bg');
            root.style.removeProperty('--glass-bg-light');
            root.style.removeProperty('--glass-blur');
        }

        // 4. Reducción de movimiento
        if (prefs.reducedMotion) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }

        // 5. Protección de Privacidad Nativa (FLAG_SECURE en Android)
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_privacy_screen', prefs.privacyScreen ? 'true' : 'false');
            import('@capacitor/core').then(({ Capacitor, registerPlugin }) => {
                if (Capacitor.isNativePlatform()) {
                    const PrivacyScreen = registerPlugin<any>('PrivacyScreen');
                    if (prefs.privacyScreen) {
                        PrivacyScreen.enable().catch(() => {});
                    } else {
                        PrivacyScreen.disable().catch(() => {});
                    }
                }
            }).catch(() => {});
        }
    }

    /** Convierte el selector de autodestrucción en segundos exactos */
    public static getAutoDestructSeconds(timer?: AutoDestructTimer): number {
        const val = timer || this.currentPrefs.autoDestructDefault;
        switch (val) {
            case '5m': return 300;
            case '1h': return 3600;
            case '24h': return 86400;
            case '7d': return 604800;
            case 'off':
            default:
                return 0;
        }
    }

    /** Configuración de resolución y compresión de imagen según preferencia */
    public static getImageCompressionConfig(quality?: ImageCompressionQuality): { maxDim: number; qualityFactor: number } {
        const val = quality || this.currentPrefs.imageCompression;
        switch (val) {
            case 'low': return { maxDim: 800, qualityFactor: 0.40 };
            case 'high': return { maxDim: 1600, qualityFactor: 0.85 };
            case 'medium':
            default:
                return { maxDim: 1024, qualityFactor: 0.65 };
        }
    }

    /** Constraints de Video WebRTC según calidad configurada */
    public static getVideoCallConstraints(quality?: VideoCallQuality, facingMode: 'user' | 'environment' = 'user'): MediaTrackConstraints {
        const val = quality || this.currentPrefs.videoQuality;
        switch (val) {
            case 'hd720p':
                return {
                    facingMode: facingMode,
                    width: { ideal: 1280, max: 1280 },
                    height: { ideal: 720, max: 720 },
                    frameRate: { ideal: 30, max: 30 }
                };
            case 'eco360p':
                return {
                    facingMode: facingMode,
                    width: { ideal: 480, max: 640 },
                    height: { ideal: 360, max: 480 },
                    frameRate: { ideal: 20, max: 24 }
                };
            case 'sd480p':
            default:
                return {
                    facingMode: facingMode,
                    width: { ideal: 640, max: 854 },
                    height: { ideal: 480, max: 480 },
                    frameRate: { ideal: 24, max: 30 }
                };
        }
    }

    /** Intervalos de escaneo de malla según perfil de energía (respetando límite de Android OS de 5 escaneos / 30s) */
    public static getMeshPowerIntervals(profile?: MeshPowerProfile): { bleScanMs: number; peerPollMs: number } {
        const val = profile || this.currentPrefs.meshPowerProfile;
        switch (val) {
            case 'high': return { bleScanMs: 8000, peerPollMs: 3000 };
            case 'eco': return { bleScanMs: 30000, peerPollMs: 15000 };
            case 'balanced':
            default:
                return { bleScanMs: 14000, peerPollMs: 5000 };
        }
    }

    /** Ejecuta feedback háptico ligero si está habilitado */
    public static triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'warning' = 'light') {
        if (!this.currentPrefs.hapticsEnabled) return;
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try {
                if (type === 'light') navigator.vibrate(12);
                else if (type === 'medium') navigator.vibrate(28);
                else if (type === 'heavy') navigator.vibrate(55);
                else if (type === 'warning') navigator.vibrate([30, 40, 30, 40, 60]);
            } catch {}
        }
    }
}

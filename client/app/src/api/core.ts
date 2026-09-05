// RED API Core Dispatcher, Storage Helpers & Crypto Utilities

export const STORAGE_KEYS = {
    GUARDIAN_REPORTS: 'red_guardian_reports',
    GUARDIAN_STATS: 'red_guardian_stats',
    AMBER_ALERTS: 'red_amber_alerts',
    SOS_BEACONS: 'red_sos_beacons',
    CHANNEL_MESSAGES: 'red_channel_messages',
    VOICE_BURSTS: 'red_voice_bursts',
    WEATHER_REPORTS: 'red_weather_reports',
    DISCOVERY_CONFIG: 'red_discovery_config',
    EPHEMERAL_CONFIG: 'red_ephemeral_config',
    P2P_WALLET: 'red_p2p_wallet',
    P2P_VOUCHERS: 'red_p2p_vouchers',
    P2P_REDEEMED: 'red_p2p_redeemed_vouchers',
    RF_METRICS: 'red_rf_metrics',
    RF_CONFIG: 'red_rf_config',
    STEGO_CAPSULES: 'red_stego_capsules',
    TRIAGE_REPORTS: 'red_triage_reports',
    EMERGENCY_BEACONS: 'red_emergency_beacons',
    DMS_CONFIG: 'red_dms_config',
    BLACKOUT_STATUS: 'red_blackout_status',
    SOCIAL_POSTS: 'red_social_posts',
    SOCIAL_FOLLOWING: 'red_social_following',
    NODE_LOGS: 'red_node_logs',
};

export function getStored<T>(key: string, defaultVal: T): T {
    if (typeof window === 'undefined') return defaultVal;
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultVal;
    } catch {
        return defaultVal;
    }
}

export function setStored<T>(key: string, val: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
        console.warn(`[RED:storage] No se pudo guardar ${key}:`, e);
    }
}

// ── v70.1: Almacenamiento seguro cifrado (AES-256-GCM via Keystore de Android) ──
// Claves sensibles que NO deben ir en localStorage en texto claro:
export const SECURE_KEYS = new Set([
    'red_guardian_reports', 'red_amber_alerts', 'red_sos_beacons',
    'red_stego_capsules', 'red_triage_reports', 'red_blackout_status',
    'red_emergency_beacons', 'red_p2p_wallet', 'red_p2p_vouchers',
]);

/** Lee un valor del almacenamiento seguro del OS (Keystore Android / Keychain iOS).
 *  Fallback transparente a localStorage si no estamos en Capacitor nativo. */
export async function getSecureStored<T>(key: string, defaultVal: T): Promise<T> {
    try {
        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
        const result = await SecureStoragePlugin.get({ key });
        return JSON.parse(result.value) as T;
    } catch {
        // En caso de fallo de Keystore tras reinstalación o corrupción, purgar clave huérfana
        try {
            const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
            await SecureStoragePlugin.remove({ key });
        } catch {}
        // Usar localStorage como fallback confiable
        return getStored(key, defaultVal);
    }
}

/** Escribe un valor en el almacenamiento seguro del OS.
 *  Fallback transparente a localStorage si no estamos en Capacitor nativo. */
export async function setSecureStored<T>(key: string, val: T): Promise<void> {
    try {
        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
        await SecureStoragePlugin.set({ key, value: JSON.stringify(val) });
    } catch {
        // Fallback: localStorage (solo en browser/dev — en producción Android sí usa Keystore)
        setStored(key, val);
    }
}

export function getNodeUrl(): string {
    if (typeof window === 'undefined') return 'http://127.0.0.1:7333';
    const custom = localStorage.getItem('red_node_url');
    if (custom) {
        return custom.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    }
    return 'http://127.0.0.1:7333';
}

// ── v70.1: Token de sesión local ─────────────────────────────────────────────
// Cacheado en memoria — se carga una vez al inicio desde Capacitor Filesystem.
let _sessionTokenCache: string | null = null;

/** Lee el token de sesión del nodo desde el archivo session.token (Capacitor nativo).
 *  En contexto web/browser retorna null (el nodo acepta sin token por loopback en dev).
 *  Exportada para uso en RedAPIClient.req() — path Zero-Trust autenticado. */
export async function getSessionToken(): Promise<string | null> {
    if (_sessionTokenCache) return _sessionTokenCache;
    try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const result = await Filesystem.readFile({
            path: 'red_node/session.token',
            directory: Directory.Data,
            encoding: 'utf8' as any,
        });
        const token = (result.data as string).trim();
        if (token.length === 64) {
            _sessionTokenCache = token;
            return token;
        }
    } catch {
        // En browser o si el nodo no ha arrancado todavía: verificar almacenamiento local
    }
    if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('red_session_token') || localStorage.getItem('red_api_key');
        if (stored && stored.trim().length > 0) {
            _sessionTokenCache = stored.trim();
            return _sessionTokenCache;
        }
    }
    return null;
}

/** Invalida el cache del token (útil cuando el nodo se reinicia). */
export function invalidateSessionTokenCache(): void {
    _sessionTokenCache = null;
}

export interface FetchNodeOptions extends RequestInit {
    timeoutMs?: number;
    maxRetries?: number;
}

/** Resilient helper for GET/POST API endpoints with local offline fallback engines */
/** Fetch al nodo local con AbortController timeout dinámico (60s para IA, 5s estándar), token de sesión y retry */
async function fetchNodeWithRetry(url: string, options?: FetchNodeOptions): Promise<Response> {
    const isAiInference = url.includes('/api/ai/') || url.includes('/v1/chat/') || url.includes('/api/generate');
    const defaultTimeout = isAiInference ? 60000 : 5000;
    const timeoutMs = options?.timeoutMs ?? defaultTimeout;
    const maxAttempts = options?.maxRetries ?? (isAiInference ? 1 : 2);

    let lastError: unknown;
    // Obtener token de sesión una vez (cacheado en memoria tras el primer fetch)
    const sessionToken = await getSessionToken();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const authHeaders: Record<string, string> = sessionToken ? {
                'X-Red-Session-Token': sessionToken,
                'X-API-Key': sessionToken,
                'Authorization': `Bearer ${sessionToken}`
            } : {};

            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...authHeaders,
                    ...options?.headers
                }
            });
            clearTimeout(timer);
            return res;
        } catch (e) {
            clearTimeout(timer);
            lastError = e;
            if (attempt < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}

export async function fetchWithFallback<T>(
    path: string,
    options?: FetchNodeOptions,
    fallbackFn?: () => T | Promise<T>
): Promise<T> {
    try {
        const url = `${getNodeUrl()}${path}`;
        const res = await fetchNodeWithRetry(url, options);
        if (res.ok) {
            return await res.json();
        }
        console.warn(`[RED:node] ${path} → HTTP ${res.status}`);
    } catch (e) {
        console.warn(`[RED:node] ${path} → sin respuesta (${(e as Error)?.message ?? 'timeout'}). Usando engine local.`);
    }

    if (fallbackFn) {
        return await fallbackFn();
    }
    throw new Error(`[RED API Fallback] ${path} unavailable`);
}

/** SHA-256 Digest utility */
export async function hashStringSha256(data: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {}
    }
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
}

export const sha256Hex = hashStringSha256;

/** Strips EXIF metadata by drawing image onto clean Canvas buffer */
export async function stripExifFromBase64Image(base64Image: string): Promise<{ cleanedB64: string; bytesStripped: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 800;
                canvas.height = img.naturalHeight || img.height || 600;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve({ cleanedB64: base64Image, bytesStripped: 0 });
                    return;
                }
                ctx.drawImage(img, 0, 0);
                const cleaned = canvas.toDataURL('image/jpeg', 0.92);
                const origLen = base64Image.length;
                const newLen = cleaned.length;
                const diff = Math.max(0, origLen - newLen);
                resolve({ cleanedB64: cleaned, bytesStripped: diff });
            } catch {
                resolve({ cleanedB64: base64Image, bytesStripped: 0 });
            }
        };
        img.onerror = () => {
            resolve({ cleanedB64: base64Image, bytesStripped: 0 });
        };
        img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    });
}

export const stripExifCanvas = stripExifFromBase64Image;

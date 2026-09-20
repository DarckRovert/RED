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
    // Fallback: SHA-256 pure-JS (FIPS 180-4) para entornos sin crypto.subtle
    // — Evita colisiones de djb2 que silenciaban mensajes reales en el deduplicador —
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    // UTF-8 encode
    const bytes: number[] = [];
    for (let i = 0; i < data.length; i++) {
        const c = data.charCodeAt(i);
        if (c < 0x80) { bytes.push(c); }
        else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
        else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    const len = bytes.length;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    const bitLen = len * 8;
    bytes.push(0, 0, 0, 0, (bitLen / 0x100000000) >>> 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
    let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Array(64);
    for (let blk = 0; blk < bytes.length; blk += 64) {
        for (let i = 0; i < 16; i++) w[i] = (bytes[blk+i*4]<<24)|(bytes[blk+i*4+1]<<16)|(bytes[blk+i*4+2]<<8)|bytes[blk+i*4+3];
        for (let i = 16; i < 64; i++) {
            const s0 = ((w[i-15]>>>7)|(w[i-15]<<25)) ^ ((w[i-15]>>>18)|(w[i-15]<<14)) ^ (w[i-15]>>>3);
            const s1 = ((w[i-2]>>>17)|(w[i-2]<<15)) ^ ((w[i-2]>>>19)|(w[i-2]<<13)) ^ (w[i-2]>>>10);
            w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
        }
        let [a,b,c,d,e,f,g,hh] = [h0,h1,h2,h3,h4,h5,h6,h7];
        for (let i = 0; i < 64; i++) {
            const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
            const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+hh)|0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(n => (n>>>0).toString(16).padStart(8,'0')).join('');
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

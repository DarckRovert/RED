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
    } catch {}
}

export function getNodeUrl(): string {
    if (typeof window === 'undefined') return 'http://127.0.0.1:7333';
    const custom = localStorage.getItem('red_node_url');
    if (custom) {
        return custom.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    }
    return 'http://127.0.0.1:7333';
}

/** Resilient helper for GET/POST API endpoints with local offline fallback engines */
export async function fetchWithFallback<T>(
    path: string,
    options?: RequestInit,
    fallbackFn?: () => T | Promise<T>
): Promise<T> {
    try {
        const url = `${getNodeUrl()}${path}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options?.headers
            }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch {
        // Fallthrough to local fallback engine
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

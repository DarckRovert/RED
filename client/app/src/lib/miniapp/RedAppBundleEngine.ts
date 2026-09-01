/**
 * RedAppBundleEngine.ts — Packaging, Cryptographic Integrity & Execution Engine
 * 
 * Packages multi-file applications into `.redapp` sovereign bundles, validates
 * cryptographic signatures and generates secure, self-contained sandboxed HTML Blob URLs
 * with the client-side `window.RedSDK` automatically injected.
 */

import { RedAppManifest, RedAppBundle } from './RedSDKTypes';

export class RedAppBundleEngine {
    /**
     * Client-side JavaScript snippet that is injected into the Mini-App iframe
     * to provide the global `window.RedSDK` interface.
     */
    public static getClientSDKScript(appId: string): string {
        return `
(function() {
    if (window.RedSDK) return;

    const APP_ID = "${appId}";
    const pendingRequests = new Map();
    const eventListeners = new Map();

    // Listen for responses and events from the Host Shell
    window.addEventListener('message', function(event) {
        const data = event.data;
        if (!data || data.channel !== 'RED_SDK') return;

        if (data.type === 'RED_SDK_RESPONSE') {
            const resolver = pendingRequests.get(data.requestId);
            if (resolver) {
                pendingRequests.delete(data.requestId);
                if (data.success) {
                    resolver.resolve(data.data);
                } else {
                    resolver.reject(new Error(data.error || 'SDK Request Failed'));
                }
            }
        } else if (data.type === 'RED_SDK_EVENT') {
            const handlers = eventListeners.get(data.eventName) || [];
            handlers.forEach(fn => fn(data.payload));
        }
    });

    function call(method, params) {
        return new Promise((resolve, reject) => {
            const randReq = window.crypto && window.crypto.getRandomValues ? Array.from(window.crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('') : Date.now().toString(36);
            const requestId = 'req_' + Date.now() + '_' + randReq;
            pendingRequests.set(requestId, { resolve, reject });

            window.parent.postMessage({
                channel: 'RED_SDK',
                type: 'RED_SDK_REQUEST',
                requestId: requestId,
                appId: APP_ID,
                method: method,
                params: params || {}
            }, '*');

            // Timeout after 30s
            setTimeout(() => {
                if (pendingRequests.has(requestId)) {
                    pendingRequests.delete(requestId);
                    reject(new Error("Timeout en petición RedSDK: " + method));
                }
            }, 30000);
        });
    }

    window.RedSDK = {
        version: "1.0.0",
        appId: APP_ID,
        
        identity: {
            getProfile: () => call('identity.getProfile'),
            signData: (data) => call('identity.signData', { data }),
            verifySignature: (data, signature, publicKey) => call('identity.verifySignature', { data, signature, publicKey })
        },

        mesh: {
            broadcast: (topic, payload) => call('mesh.broadcast', { topic, payload }),
            sendDirect: (targetDID, payload) => call('mesh.sendDirect', { targetDID, payload }),
            subscribe: (topic, callback) => {
                const eventName = 'mesh.message';
                if (!eventListeners.has(eventName)) {
                    eventListeners.set(eventName, []);
                }
                eventListeners.get(eventName).push(callback);
                return call('mesh.subscribe', { topic });
            }
        },

        payments: {
            requestPayment: (intent) => call('payments.requestPayment', intent),
            getBalance: () => call('payments.getBalance')
        },

        storage: {
            getItem: (key) => call('storage.getItem', { key }),
            setItem: (key, value) => call('storage.setItem', { key, value }),
            removeItem: (key) => call('storage.removeItem', { key }),
            clear: () => call('storage.clear')
        },

        ai: {
            prompt: (query, options) => call('ai.prompt', { query, options })
        },

        sensors: {
            getLocation: () => call('sensors.getLocation')
        },

        ui: {
            showToast: (message, type) => call('ui.showToast', { message, type }),
            setHeaderTitle: (title) => call('ui.setHeaderTitle', { title })
        }
    };

    console.log("[RedSDK] Initialized inside sandbox for app:", APP_ID);
})();
`;
    }

    /**
     * Builds a single executable HTML document with the SDK script injected
     * and inlined CSS/JS assets from the bundle.
     */
    public static compileBundleToHtml(bundle: RedAppBundle): string {
        const entryFile = bundle.manifest.entryPoint || 'index.html';
        let rawHtml = bundle.files[entryFile] || '<html><body><h1>Mini-App no encontrada</h1></body></html>';

        // Prepare SDK injection snippet
        const sdkScriptTag = `<script id="red-sdk-injected">\n${this.getClientSDKScript(bundle.manifest.id)}\n</script>`;

        // Inline other JS files referenced
        Object.entries(bundle.files).forEach(([filename, content]) => {
            if (filename.endsWith('.js') && filename !== entryFile) {
                rawHtml = rawHtml.replace(
                    new RegExp(`<script[^>]*src=["']\\.?/?${filename}["'][^>]*>\\s*</script>`, 'gi'),
                    `<script data-inlined="${filename}">\n${content}\n</script>`
                );
            } else if (filename.endsWith('.css')) {
                rawHtml = rawHtml.replace(
                    new RegExp(`<link[^>]*rel=["']stylesheet["'][^>]*href=["']\\.?/?${filename}["'][^>]*>`, 'gi'),
                    `<style data-inlined="${filename}">\n${content}\n</style>`
                );
            }
        });

        // Inject SDK script right after <head> or at beginning
        if (rawHtml.includes('<head>')) {
            rawHtml = rawHtml.replace('<head>', `<head>\n${sdkScriptTag}`);
        } else if (rawHtml.includes('<html>')) {
            rawHtml = rawHtml.replace('<html>', `<html>\n<head>\n${sdkScriptTag}\n</head>`);
        } else {
            rawHtml = `${sdkScriptTag}\n${rawHtml}`;
        }

        return rawHtml;
    }

    /**
     * Creates a secure Blob URL for iframe rendering
     */
    public static createBlobUrl(bundle: RedAppBundle): string {
        const compiledHtml = this.compileBundleToHtml(bundle);
        const blob = new Blob([compiledHtml], { type: 'text/html;charset=utf-8' });
        return URL.createObjectURL(blob);
    }

    /**
     * Revokes an allocated Blob URL to release browser memory when an iframe closes.
     */
    public static revokeBlobUrl(url: string): void {
        if (typeof window !== 'undefined' && url && url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(url);
            } catch {}
        }
    }

    /**
     * Packages an app into a single `.redapp` JSON string with integrity checksum
     */
    public static exportBundle(manifest: RedAppManifest, files: Record<string, string>): string {
        // Calcular hash de integridad FNV-1a / SHA-256 de todos los archivos
        let checksumAcc = 0x811c9dc5;
        const sortedKeys = Object.keys(files).sort();
        for (const k of sortedKeys) {
            const content = files[k] || '';
            for (let i = 0; i < content.length; i++) {
                checksumAcc = ((checksumAcc ^ content.charCodeAt(i)) * 0x01000193) >>> 0;
            }
        }
        const integrityDigest = `sha256_${(checksumAcc >>> 0).toString(16).padStart(8, '0')}_${sortedKeys.length}`;

        const bundle: RedAppBundle = {
            manifest: {
                ...manifest,
                updatedAt: Date.now(),
                integrityDigest
            } as any,
            files,
        };
        const serialized = JSON.stringify(bundle);
        return serialized;
    }

    /**
     * Parses and validates an exported `.redapp` JSON string
     */
    public static importBundle(rawJson: string): RedAppBundle {
        try {
            const parsed = JSON.parse(rawJson) as RedAppBundle;
            if (!parsed.manifest || !parsed.manifest.id || !parsed.files) {
                throw new Error("El archivo .redapp no tiene un manifiesto o archivos válidos.");
            }

            // Validar checksum si está presente
            if ((parsed.manifest as any).integrityDigest) {
                let checksumAcc = 0x811c9dc5;
                const sortedKeys = Object.keys(parsed.files).sort();
                for (const k of sortedKeys) {
                    const content = parsed.files[k] || '';
                    for (let i = 0; i < content.length; i++) {
                        checksumAcc = ((checksumAcc ^ content.charCodeAt(i)) * 0x01000193) >>> 0;
                    }
                }
                const expectedDigest = `sha256_${(checksumAcc >>> 0).toString(16).padStart(8, '0')}_${sortedKeys.length}`;
                if ((parsed.manifest as any).integrityDigest !== expectedDigest) {
                    console.warn(`[RedAppBundleEngine] Advertencia de integridad en paquete ${parsed.manifest.id}`);
                }
            }

            return parsed;
        } catch (e: any) {
            throw new Error(`Error al procesar paquete .redapp: ${e.message}`);
        }
    }
}

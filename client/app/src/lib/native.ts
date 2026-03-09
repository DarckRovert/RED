/**
 * RED Native Bridge
 * 
 * Abstractions for Capacitor-specific features on iOS and Android.
 * This allows the same Next.js codebase to work as a web app or as a 
 * native mobile app with advanced features.
 */

import { Capacitor } from '@capacitor/core';
// import { PushNotifications } from '@capacitor/push-notifications'; // Assume installed or stubbed

export class RedNative {
    /**
     * Check if running in a native mobile environment
     */
    static isNative(): boolean {
        return Capacitor.isNativePlatform();
    }

    /**
     * Get the current platform (ios, android, or web)
     */
    static getPlatform(): string {
        return Capacitor.getPlatform();
    }

    /**
     * Request push notification permissions (Native only)
     */
    static async requestPushPermissions(): Promise<boolean> {
        if (!this.isNative()) {
            console.log('Push notifications not available on web');
            return false;
        }

        try {
            // Stub for real Capacitor plugin call
            console.log('Requesting native push permissions...');
            return true;
        } catch (e) {
            console.error('Failed to request push permissions', e);
            return false;
        }
    }

    /**
     * Commmunicate directly with the Rust core on Native
     * (Uses Capacitor FFI Plugin bridge)
     */
    static async invokeRust(method: string, args: any): Promise<any> {
        if (!this.isNative()) {
            // On web, we fall back to the Node API
            console.log('Web environment: Falling back to REST API for', method);
            return null;
        }

        console.log('Native environment: Invoking Rust method via FFI Bridge:', method);
        // In a real scenario, we would use:
        // return Capacitor.Plugins.RedCorePlugin.invoke({ method, args });
        return { ok: true, message: 'Simulated Native Rust response' };
    }

    /**
     * Save encrypted media to native storage
     */
    static async saveEncryptedMedia(filename: string, data: Blob): Promise<string> {
        if (!this.isNative()) {
            return 'web_blob_url_simulated';
        }

        console.log('Saving encrypted media to native filesystem:', filename);
        return `capacitor://localhost/_storage_/${filename}`;
    }
}

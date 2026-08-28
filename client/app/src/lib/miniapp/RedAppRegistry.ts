/**
 * RedAppRegistry.ts — Sovereign Mini-App Registry & Persistent Catalog
 * 
 * Manages installed Mini-Apps, permissions granted per app, and initializes built-in dApps.
 */

import { RedAppManifest, RedAppBundle, RedPermissionScope } from './RedSDKTypes';
import { bazaarAppBundle } from './builtin/bazaarApp';
import { meshWikiAppBundle } from './builtin/meshWikiApp';
import { p2pBattleshipAppBundle } from './builtin/p2pBattleshipApp';

export interface InstalledAppEntry {
    manifest: RedAppManifest;
    bundle: RedAppBundle;
    installedAt: number;
    lastOpenedAt: number;
    grantedPermissions: RedPermissionScope[];
    isBuiltin: boolean;
}

const STORAGE_KEY = 'red_installed_miniapps_v1';
const PERMISSIONS_STORAGE_KEY = 'red_app_granted_permissions_v1';

export class RedAppRegistry {
    private static instance: RedAppRegistry | null = null;
    private apps: Map<string, InstalledAppEntry> = new Map();

    private constructor() {
        this.loadFromStorage();
        this.ensureBuiltinApps();
    }

    public static getInstance(): RedAppRegistry {
        if (!RedAppRegistry.instance) {
            RedAppRegistry.instance = new RedAppRegistry();
        }
        return RedAppRegistry.instance;
    }

    private loadFromStorage() {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const list = JSON.parse(raw) as InstalledAppEntry[];
                list.forEach(entry => this.apps.set(entry.manifest.id, entry));
            }
        } catch (e) {
            console.error("[RedAppRegistry] Error loading apps from storage:", e);
        }
    }

    private saveToStorage() {
        if (typeof window === 'undefined') return;
        try {
            const list = Array.from(this.apps.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.error("[RedAppRegistry] Error saving apps to storage:", e);
        }
    }

    private ensureBuiltinApps() {
        const builtins: RedAppBundle[] = [
            bazaarAppBundle,
            meshWikiAppBundle,
            p2pBattleshipAppBundle,
        ];

        builtins.forEach(bundle => {
            const existing = this.apps.get(bundle.manifest.id);
            if (!existing) {
                this.apps.set(bundle.manifest.id, {
                    manifest: bundle.manifest,
                    bundle,
                    installedAt: Date.now(),
                    lastOpenedAt: Date.now(),
                    grantedPermissions: bundle.manifest.permissions,
                    isBuiltin: true,
                });
            } else {
                // Update bundle content while preserving user permissions
                existing.manifest = bundle.manifest;
                existing.bundle = bundle;
                existing.isBuiltin = true;
            }
        });
        this.saveToStorage();
    }

    public getAllApps(): InstalledAppEntry[] {
        return Array.from(this.apps.values()).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    }

    public getApp(appId: string): InstalledAppEntry | undefined {
        return this.apps.get(appId);
    }

    public installApp(bundle: RedAppBundle, grantedPermissions?: RedPermissionScope[]): InstalledAppEntry {
        const entry: InstalledAppEntry = {
            manifest: bundle.manifest,
            bundle,
            installedAt: Date.now(),
            lastOpenedAt: Date.now(),
            grantedPermissions: grantedPermissions || bundle.manifest.permissions,
            isBuiltin: false,
        };
        this.apps.set(bundle.manifest.id, entry);
        this.saveToStorage();
        return entry;
    }

    public uninstallApp(appId: string): boolean {
        const app = this.apps.get(appId);
        if (app?.isBuiltin) {
            console.warn("No se pueden desinstalar aplicaciones nativas del sistema.");
            return false;
        }
        const deleted = this.apps.delete(appId);
        if (deleted) this.saveToStorage();
        return deleted;
    }

    public updatePermissions(appId: string, permissions: RedPermissionScope[]) {
        const app = this.apps.get(appId);
        if (app) {
            app.grantedPermissions = permissions;
            this.saveToStorage();
        }
    }

    public touchApp(appId: string) {
        const app = this.apps.get(appId);
        if (app) {
            app.lastOpenedAt = Date.now();
            this.saveToStorage();
        }
    }
}

export const redAppRegistry = RedAppRegistry.getInstance();

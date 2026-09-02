/**
 * TacticalGeofenceEngine.ts — RED Multi-Perimeter Tactical Geofencing & RF-Silence Governor
 * 
 * Manages tactical exclusion zones, safe corridors, defensive perimeter alarms,
 * and automated RF-silence triggers for electronic warfare / SIGINT evasion.
 */

import { OffGridNavigationEngine } from '../emergency/OffGridNavigationEngine';
import { TacticalAudioEngine } from '../audio/TacticalAudioEngine';

export type GeofenceZoneCategory = 'SAFE_HAVEN' | 'EXCLUSION_ZONE' | 'RF_SILENCE' | 'DEFENSIVE_PERIMETER';
export type GeofenceGeometryType = 'CIRCULAR' | 'POLYGON';

export interface TacticalGeofenceZone {
    id: string;
    name: string;
    category: GeofenceZoneCategory;
    geometryType: GeofenceGeometryType;
    centerLat: number;
    centerLon: number;
    radiusMeters: number;
    polygonCoords?: { lat: number; lon: number }[];
    active: boolean;
    triggerRfSilence: boolean;
    triggerSilentAlarm: boolean;
    createdAt: number;
}

export interface GeofenceEvaluation {
    activeInsideZones: TacticalGeofenceZone[];
    isRfSilenceMandated: boolean;
    currentAlarmZone: TacticalGeofenceZone | null;
    closestZone: TacticalGeofenceZone | null;
    closestDistanceMeters: number | null;
}

const STORAGE_GEOFENCES_KEY = 'red_tactical_geofences_v1';

export class TacticalGeofenceEngine {
    private static instance: TacticalGeofenceEngine | null = null;
    private zones: Map<string, TacticalGeofenceZone> = new Map();
    private lastEvaluation: GeofenceEvaluation = {
        activeInsideZones: [],
        isRfSilenceMandated: false,
        currentAlarmZone: null,
        closestZone: null,
        closestDistanceMeters: null,
    };
    private listeners: Set<(evalResult: GeofenceEvaluation) => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadZones();
        }
    }

    public static getInstance(): TacticalGeofenceEngine {
        if (!this.instance) {
            this.instance = new TacticalGeofenceEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (evalResult: GeofenceEvaluation) => void): () => void {
        this.listeners.add(cb);
        cb(this.lastEvaluation);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(this.lastEvaluation); } catch {}
        });
    }

    private loadZones() {
        try {
            const raw = localStorage.getItem(STORAGE_GEOFENCES_KEY);
            if (raw) {
                const arr: TacticalGeofenceZone[] = JSON.parse(raw);
                arr.forEach(z => this.zones.set(z.id, z));
            } else {
                // Zonas predeterminadas de ejemplo si no existen
                const defaultZone: TacticalGeofenceZone = {
                    id: 'ZONE-DEFCON-1',
                    name: 'Perímetro Base Central',
                    category: 'SAFE_HAVEN',
                    geometryType: 'CIRCULAR',
                    centerLat: 0,
                    centerLon: 0,
                    radiusMeters: 500,
                    active: false,
                    triggerRfSilence: false,
                    triggerSilentAlarm: true,
                    createdAt: Date.now(),
                };
                this.zones.set(defaultZone.id, defaultZone);
            }
        } catch (e) {
            console.error('[TacticalGeofenceEngine] Error loading zones:', e);
        }
    }

    private saveZones() {
        try {
            const arr = Array.from(this.zones.values());
            localStorage.setItem(STORAGE_GEOFENCES_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('[TacticalGeofenceEngine] Error saving zones:', e);
        }
    }

    public getZones(): TacticalGeofenceZone[] {
        return Array.from(this.zones.values());
    }

    public createZone(zoneData: Omit<TacticalGeofenceZone, 'id' | 'createdAt'>): TacticalGeofenceZone {
        const randSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(2))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
            : (Date.now() % 10000).toString(16).toUpperCase();
        const id = `GEO-${Date.now().toString(36).toUpperCase()}-${randSuffix}`;

        const safeLat = (typeof zoneData.centerLat === 'number' && isFinite(zoneData.centerLat)) ? zoneData.centerLat : 0;
        const safeLon = (typeof zoneData.centerLon === 'number' && isFinite(zoneData.centerLon)) ? zoneData.centerLon : 0;
        const safeRadius = (typeof zoneData.radiusMeters === 'number' && isFinite(zoneData.radiusMeters) && zoneData.radiusMeters > 0)
            ? zoneData.radiusMeters : 100;

        const zone: TacticalGeofenceZone = {
            ...zoneData,
            id,
            centerLat: safeLat,
            centerLon: safeLon,
            radiusMeters: safeRadius,
            createdAt: Date.now(),
        };
        this.zones.set(id, zone);
        this.saveZones();
        return zone;
    }

    public deleteZone(id: string): boolean {
        const deleted = this.zones.delete(id);
        if (deleted) this.saveZones();
        return deleted;
    }

    public toggleZone(id: string): boolean {
        const zone = this.zones.get(id);
        if (!zone) return false;
        zone.active = !zone.active;
        this.saveZones();
        return zone.active;
    }

    /**
     * Evalúa la posición GPS del operador respecto a todas las geocercas activas
     */
    public evaluatePosition(userLat: number, userLon: number): GeofenceEvaluation {
        if (typeof userLat !== 'number' || typeof userLon !== 'number' ||
            !isFinite(userLat) || !isFinite(userLon) ||
            (Math.abs(userLat) < 0.0001 && Math.abs(userLon) < 0.0001)) {
            return this.lastEvaluation;
        }

        const activeZones = Array.from(this.zones.values()).filter(z => z.active);
        const insideZones: TacticalGeofenceZone[] = [];
        let isRfSilenceMandated = false;
        let alarmZone: TacticalGeofenceZone | null = null;
        let minDistance: number | null = null;
        let closest: TacticalGeofenceZone | null = null;

        activeZones.forEach(zone => {
            const dist = this.getHaversineDistanceMeters(userLat, userLon, zone.centerLat, zone.centerLon);

            if (minDistance === null || dist < minDistance) {
                minDistance = dist;
                closest = zone;
            }

            let isInside = false;
            if (zone.geometryType === 'CIRCULAR') {
                isInside = dist <= zone.radiusMeters;
            } else if (zone.geometryType === 'POLYGON' && zone.polygonCoords && zone.polygonCoords.length >= 3) {
                try {
                    isInside = OffGridNavigationEngine.isPointInGeofence(
                        { lat: userLat, lon: userLon },
                        zone.polygonCoords
                    );
                } catch {
                    isInside = false;
                }
            }

            if (isInside) {
                insideZones.push(zone);
                if (zone.triggerRfSilence || zone.category === 'RF_SILENCE') {
                    isRfSilenceMandated = true;
                }
                if (zone.triggerSilentAlarm || zone.category === 'EXCLUSION_ZONE') {
                    alarmZone = zone;
                }
            }
        });

        // Detección de transiciones de estado para alerta sonora/háptica
        const previouslyInside = this.lastEvaluation.activeInsideZones.length > 0;
        const nowInside = insideZones.length > 0;

        if (!previouslyInside && nowInside) {
            TacticalAudioEngine.playRogerBeep();
        } else if (alarmZone && !this.lastEvaluation.currentAlarmZone) {
            TacticalAudioEngine.playEmergencyAlarm();
        }

        this.lastEvaluation = {
            activeInsideZones: insideZones,
            isRfSilenceMandated,
            currentAlarmZone: alarmZone,
            closestZone: closest,
            closestDistanceMeters: minDistance,
        };

        this.notify();
        return this.lastEvaluation;
    }

    private getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
        if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
            return Infinity;
        }
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const safeA = Math.max(0, Math.min(1, a));
        const c = 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
        return Math.round(R * c);
    }

    public destroy(): void {
        this.listeners.clear();
    }
}

export const tacticalGeofence = TacticalGeofenceEngine.getInstance();

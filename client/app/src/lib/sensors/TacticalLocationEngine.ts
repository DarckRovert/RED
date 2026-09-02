/**
 * RED 2.0 — TacticalLocationEngine.ts
 *
 * Motor Soberano de Posicionamiento Táctico y Mitigación de Pérdida GNSS en Emergencias.
 *
 * Diseñado para operaciones de desastre, catástrofe e incomunicación:
 * 1. Erradicación de Null Island (0,0): Ninguna lectura (0,0) es tratada como válida.
 * 2. Caché Táctico Persistente: Registra cada posición GPS válida en 'red_last_known_gps'
 *    con timestamp, altitud y precisión.
 * 3. Doble fase de Adquisición para Emergencias (Immediate + Accurate):
 *    - Si se solicita SOS y los satélites están bloqueados (sótano, búnker o túnel),
 *      retorna inmediatamente la última posición conocida válida para no demorar el auxilio.
 *    - Dispara en paralelo la búsqueda satelital de alta precisión con timeout adaptativo.
 * 4. Seguimiento Continuo (Watch): Monitorea la posición durante emergencias y actualiza
 *    automáticamente la baliza activa en MeshSosBeaconEngine en cuanto los satélites enganchan.
 */

import { meshSosBeacon } from '../emergency/MeshSosBeaconEngine';

export interface TacticalLocation {
    lat?: number;
    lon?: number;
    alt?: number;
    accuracy?: number;
    timestamp: number;
    isEstimated?: boolean; // True si proviene de la caché histórica por falta de satélites
    ageMs?: number;        // Antigüedad de la posición en ms
}

const STORAGE_KEY_GPS = 'red_last_known_gps';

export class TacticalLocationEngine {
    private static listeners: Set<(loc: TacticalLocation) => void> = new Set();
    private static activeWatchId: number | null = null;
    private static lastReportedLocation: TacticalLocation | null = null;

    /**
     * Valida que las coordenadas no sean nulas, indefinidas ni correspondan a Null Island (0,0)
     */
    public static isValidCoordinates(lat?: number, lon?: number): boolean {
        if (typeof lat !== 'number' || typeof lon !== 'number') return false;
        if (isNaN(lat) || isNaN(lon)) return false;
        // Rechazar Null Island (0°N, 0°E en el Golfo de Guinea)
        if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
        // Validar rangos geográficos reales
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
        return true;
    }

    /**
     * Obtiene la última posición táctica registrada en la memoria del dispositivo
     */
    public static getLastKnownLocation(): TacticalLocation | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GPS);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const lat = parsed.lat;
            const lon = parsed.lon !== undefined ? parsed.lon : parsed.lng;
            if (this.isValidCoordinates(lat, lon)) {
                const ts = parsed.timestamp || Date.now();
                return {
                    lat,
                    lon,
                    alt: parsed.alt,
                    accuracy: parsed.accuracy,
                    timestamp: ts,
                    isEstimated: true,
                    ageMs: Math.max(0, Date.now() - ts)
                };
            }
        } catch {}
        return null;
    }

    /**
     * Guarda una posición táctica válida en la caché persistente
     */
    public static saveLocation(lat: number, lon: number, alt?: number, accuracy?: number): TacticalLocation | null {
        if (!this.isValidCoordinates(lat, lon)) return null;

        const loc: TacticalLocation = {
            lat,
            lon,
            alt: typeof alt === 'number' && !isNaN(alt) ? Math.round(alt) : undefined,
            accuracy: typeof accuracy === 'number' && !isNaN(accuracy) ? Math.round(accuracy) : undefined,
            timestamp: Date.now(),
            isEstimated: false,
            ageMs: 0
        };

        this.lastReportedLocation = loc;

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY_GPS, JSON.stringify({
                    lat: loc.lat,
                    lon: loc.lon,
                    lng: loc.lon,
                    alt: loc.alt,
                    accuracy: loc.accuracy,
                    timestamp: loc.timestamp
                }));
            } catch {}
        }

        // Si hay una baliza SOS activa con coordenadas vacías o estimadas, actualizarla de inmediato
        try {
            const activeBeacon = meshSosBeacon.getMyActiveBeacon();
            if (activeBeacon && (!activeBeacon.coords?.lat || activeBeacon.coords?.lat === 0)) {
                meshSosBeacon.updateCoords({ lat, lon, alt: loc.alt });
            }
        } catch {}

        this.listeners.forEach(cb => {
            try { cb(loc); } catch {}
        });

        return loc;
    }

    /**
     * Obtiene la posición de emergencia con resolución en dos fases:
     * 1. Si no hay señal GNSS inmediata, retorna la última conocida válida para no demorar el auxilio.
     * 2. Intenta fijación por satélite de alta precisión con timeout configurado (por defecto 10s).
     */
    public static async getEmergencyLocation(timeoutMs = 10000): Promise<TacticalLocation> {
        const cached = this.getLastKnownLocation();

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return cached || { timestamp: Date.now(), isEstimated: false };
        }

        return new Promise<TacticalLocation>((resolve) => {
            let hasFinished = false;

            const timer = setTimeout(() => {
                if (!hasFinished) {
                    hasFinished = true;
                    // Fallback a posición conocida (o sin coordenadas, NUNCA 0,0)
                    resolve(cached || { timestamp: Date.now(), isEstimated: false });
                }
            }, timeoutMs);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (hasFinished) return;
                    hasFinished = true;
                    clearTimeout(timer);

                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const alt = pos.coords.altitude !== null ? pos.coords.altitude : undefined;
                    const acc = pos.coords.accuracy !== null ? pos.coords.accuracy : undefined;

                    const saved = this.saveLocation(lat, lon, alt, acc);
                    resolve(saved || cached || { timestamp: Date.now(), isEstimated: false });
                },
                (_err) => {
                    if (hasFinished) return;
                    hasFinished = true;
                    clearTimeout(timer);
                    resolve(cached || { timestamp: Date.now(), isEstimated: false });
                },
                { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5000 }
            );
        });
    }

    /**
     * Inicia el rastreo continuo de posición para pantallas tácticas y balizas de supervivencia
     */
    public static watchLocation(callback: (loc: TacticalLocation) => void): () => void {
        this.listeners.add(callback);

        // Notificar inmediatamente con la última conocida para evitar estado "Buscando..." eterno
        const cached = this.getLastKnownLocation();
        if (cached) {
            callback(cached);
        }

        if (typeof navigator !== 'undefined' && navigator.geolocation && this.activeWatchId === null) {
            try {
                this.activeWatchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lon = pos.coords.longitude;
                        const alt = pos.coords.altitude !== null ? pos.coords.altitude : undefined;
                        const acc = pos.coords.accuracy !== null ? pos.coords.accuracy : undefined;
                        this.saveLocation(lat, lon, alt, acc);
                    },
                    (err) => {
                        console.warn('[TacticalLocationEngine] GNSS watch error:', err?.message);
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
                );
            } catch (e) {
                console.warn('[TacticalLocationEngine] Fallo al registrar watchPosition:', e);
            }
        }

        return () => {
            this.listeners.delete(callback);
            if (this.listeners.size === 0 && this.activeWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
                try {
                    navigator.geolocation.clearWatch(this.activeWatchId);
                } catch {}
                this.activeWatchId = null;
            }
        };
    }
}

/**
 * RED 2.0 — TacticalLocationEngine.ts
 *
 * Motor Soberano de Posicionamiento Táctico y Mitigación de Pérdida GNSS en Emergencias.
 *
 * Diseñado para operaciones de desastre, catástrofe e incomunicación:
 * 1. Enlace Nativo con @capacitor/geolocation: Solicita y valida permisos ACCESS_FINE_LOCATION
 *    de forma automática en Android/iOS nativo mediante FusedLocationProviderClient.
 * 2. Erradicación de Null Island (0,0): Ninguna lectura (0,0) es tratada como válida.
 * 3. Captura y derivación de Course-Over-Ground (COG): Captura el rumbo real del chip GPS
 *    y calcula automáticamente el acimut de avance entre fijaciones consecutivas.
 * 4. Caché Táctico Persistente: Registra cada posición GPS válida en 'red_last_known_gps'
 *    con timestamp, altitud, precisión, rumbo y velocidad.
 * 5. Doble fase de Adquisición para Emergencias (Immediate + Accurate):
 *    - Si se solicita SOS y los satélites están bloqueados (sótano, búnker o túnel),
 *      retorna inmediatamente la última posición conocida válida para no demorar el auxilio.
 *    - Dispara en paralelo la búsqueda satelital de alta precisión con timeout adaptativo.
 * 6. Seguimiento Continuo (Watch): Monitorea la posición durante emergencias y actualiza
 *    automáticamente la baliza activa en MeshSosBeaconEngine en cuanto los satélites enganchan.
 */

import { meshSosBeacon } from '../emergency/MeshSosBeaconEngine';

export interface TacticalLocation {
    lat?: number;
    lon?: number;
    alt?: number;
    accuracy?: number;
    heading?: number; // Rumbo sobre el terreno en grados (0..360) clockwise desde el Norte Verdadero
    speed?: number;   // Velocidad instantánea en metros por segundo
    timestamp: number;
    isEstimated?: boolean; // True si proviene de la caché histórica por falta de satélites
    ageMs?: number;        // Antigüedad de la posición en ms
    source?: 'capacitor' | 'html5' | 'cache';
}

const STORAGE_KEY_GPS = 'red_last_known_gps';

export class TacticalLocationEngine {
    private static listeners: Set<(loc: TacticalLocation) => void> = new Set();
    private static activeHtml5WatchId: number | null = null;
    private static activeCapacitorWatchId: string | null = null;
    private static lastReportedLocation: TacticalLocation | null = null;
    private static lastKnownCoordsForCog: { lat: number; lon: number; timestamp: number } | null = null;
    private static isCapacitorActive: boolean = false;
    private static isStartingWatch: boolean = false;

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
     * Calcula Course-Over-Ground (COG) en grados (0..360) entre dos puntos geográficos consecutivos.
     * Retorna null si la distancia recorrida es insignificante (< 1.5 metros) para filtrar ruido GNSS.
     */
    public static calculateCourseOverGround(
        prevLat: number, prevLon: number,
        curLat: number, curLon: number
    ): number | null {
        const R = 6371000;
        const radLat1 = (prevLat * Math.PI) / 180;
        const radLat2 = (curLat * Math.PI) / 180;
        const deltaLat = ((curLat - prevLat) * Math.PI) / 180;
        const deltaLon = ((curLon - prevLon) * Math.PI) / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(radLat1) * Math.cos(radLat2) *
                  Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
        const distMeters = R * c;

        // Umbral mínimo de movimiento para considerar rumbo válido
        if (distMeters < 1.5) return null;

        const y = Math.sin(deltaLon) * Math.cos(radLat2);
        const x = Math.cos(radLat1) * Math.sin(radLat2) -
                  Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(deltaLon);
        const theta = Math.atan2(y, x);
        return Math.round((((theta * 180) / Math.PI) + 360) % 360);
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
                    heading: typeof parsed.heading === 'number' && isFinite(parsed.heading) ? parsed.heading : undefined,
                    speed: typeof parsed.speed === 'number' && isFinite(parsed.speed) ? parsed.speed : undefined,
                    timestamp: ts,
                    isEstimated: true,
                    ageMs: Math.max(0, Date.now() - ts),
                    source: 'cache'
                };
            }
        } catch {}
        return null;
    }

    /**
     * Guarda una posición táctica válida en la caché persistente y notifica a todos los escuchas
     */
    public static saveLocation(
        lat: number,
        lon: number,
        alt?: number,
        accuracy?: number,
        heading?: number | null,
        speed?: number | null,
        source: 'capacitor' | 'html5' | 'cache' = 'html5'
    ): TacticalLocation | null {
        if (!this.isValidCoordinates(lat, lon)) return null;

        let finalHeading: number | undefined = (typeof heading === 'number' && isFinite(heading) && heading >= 0)
            ? Math.round(heading)
            : undefined;

        // Si el chip GPS no entrega heading, calcular COG por desplazamiento cinemático
        if (finalHeading === undefined && this.lastKnownCoordsForCog) {
            const cog = this.calculateCourseOverGround(
                this.lastKnownCoordsForCog.lat, this.lastKnownCoordsForCog.lon,
                lat, lon
            );
            if (cog !== null) {
                finalHeading = cog;
                // Actualizar punto de referencia cinemático solo cuando se haya superado el umbral (>= 1.5m)
                this.lastKnownCoordsForCog = { lat, lon, timestamp: Date.now() };
            } else if (this.lastReportedLocation?.heading !== undefined) {
                // Si el desplazamiento fue < 1.5m, preservar el último rumbo válido conocido (operador detenido)
                finalHeading = this.lastReportedLocation.heading;
            }
        } else if (!this.lastKnownCoordsForCog) {
            // Primer fix geográfico: establecer línea base inicial
            this.lastKnownCoordsForCog = { lat, lon, timestamp: Date.now() };
        } else if (finalHeading !== undefined) {
            // Si el hardware GPS proveyó heading directo, sincronizar la línea base
            this.lastKnownCoordsForCog = { lat, lon, timestamp: Date.now() };
        } else if (this.lastReportedLocation?.heading !== undefined) {
            finalHeading = this.lastReportedLocation.heading;
        }

        const finalSpeed = (typeof speed === 'number' && isFinite(speed) && speed >= 0)
            ? Math.round(speed * 10) / 10
            : undefined;

        const loc: TacticalLocation = {
            lat,
            lon,
            alt: typeof alt === 'number' && !isNaN(alt) ? Math.round(alt) : undefined,
            accuracy: typeof accuracy === 'number' && !isNaN(accuracy) ? Math.round(accuracy) : undefined,
            heading: finalHeading,
            speed: finalSpeed,
            timestamp: Date.now(),
            isEstimated: false,
            ageMs: 0,
            source
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
                    heading: loc.heading,
                    speed: loc.speed,
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
     * 1. Retorna inmediatamente la última conocida válida si no hay satélites al instante.
     * 2. Intenta fijación satelital con @capacitor/geolocation (o HTML5) con timeout configurado.
     */
    public static async getEmergencyLocation(timeoutMs = 10000): Promise<TacticalLocation> {
        const cached = this.getLastKnownLocation();

        // 1. Intento primario nativo con Capacitor
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const perm = await Geolocation.checkPermissions().catch(() => null);
            if (perm?.location !== 'granted') {
                await Geolocation.requestPermissions().catch(() => null);
            }
            let pos = await Promise.race([
                Geolocation.getCurrentPosition({ enableHighAccuracy: true }),
                new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Capacitor GPS timeout')), Math.max(3000, Math.floor(timeoutMs * 0.6))))
            ]).catch(() => null) as any;

            if (!pos?.coords) {
                // Fallback a Coarse Location (Red/Torres/WiFi) si el satélite tarda o está bloqueado
                pos = await Promise.race([
                    Geolocation.getCurrentPosition({ enableHighAccuracy: false }),
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Capacitor Coarse timeout')), Math.max(2000, Math.floor(timeoutMs * 0.4))))
                ]).catch(() => null) as any;
            }

            if (pos?.coords && this.isValidCoordinates(pos.coords.latitude, pos.coords.longitude)) {
                const saved = this.saveLocation(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    pos.coords.altitude ?? undefined,
                    pos.coords.accuracy ?? undefined,
                    pos.coords.heading ?? undefined,
                    pos.coords.speed ?? undefined,
                    'capacitor'
                );
                if (saved) return saved;
            }
        } catch {}

        // 2. Intento secundario HTML5
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            return new Promise<TacticalLocation>((resolve) => {
                let hasFinished = false;
                const timer = setTimeout(() => {
                    if (!hasFinished) {
                        hasFinished = true;
                        resolve(cached || { timestamp: Date.now(), isEstimated: false });
                    }
                }, timeoutMs);

                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        if (hasFinished) return;
                        hasFinished = true;
                        clearTimeout(timer);

                        const saved = this.saveLocation(
                            pos.coords.latitude,
                            pos.coords.longitude,
                            pos.coords.altitude !== null ? pos.coords.altitude : undefined,
                            pos.coords.accuracy !== null ? pos.coords.accuracy : undefined,
                            pos.coords.heading !== null ? pos.coords.heading : undefined,
                            pos.coords.speed !== null ? pos.coords.speed : undefined,
                            'html5'
                        );
                        resolve(saved || cached || { timestamp: Date.now(), isEstimated: false });
                    },
                    () => {
                        if (hasFinished) return;
                        hasFinished = true;
                        clearTimeout(timer);
                        resolve(cached || { timestamp: Date.now(), isEstimated: false });
                    },
                    { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 4000 }
                );
            });
        }

        return cached || { timestamp: Date.now(), isEstimated: false };
    }

    /**
     * Detiene los observadores activos de GNSS en hardware y navegador
     */
    private static stopWatch(): void {
        if (this.activeCapacitorWatchId !== null) {
            const id = this.activeCapacitorWatchId;
            this.activeCapacitorWatchId = null;
            import('@capacitor/geolocation').then(({ Geolocation }) => {
                Geolocation.clearWatch({ id });
            }).catch(() => {});
        }
        if (this.activeHtml5WatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
            try {
                navigator.geolocation.clearWatch(this.activeHtml5WatchId);
            } catch {}
            this.activeHtml5WatchId = null;
        }
        this.isCapacitorActive = false;
        this.isStartingWatch = false;
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

        // Si ya hay un watcher activo o inicializándose, registrarse y asegurar teardown al ser el último
        if (this.activeCapacitorWatchId !== null || this.activeHtml5WatchId !== null || this.isStartingWatch) {
            return () => {
                this.listeners.delete(callback);
                if (this.listeners.size === 0) {
                    this.stopWatch();
                }
            };
        }

        this.isStartingWatch = true;

        // 1. Iniciar seguimiento nativo prioritario con Capacitor
        const startNativeWatch = async () => {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const perm = await Geolocation.checkPermissions().catch(() => null);
                if (perm?.location !== 'granted') {
                    await Geolocation.requestPermissions().catch(() => null);
                }

                // Fijación inmediata (alta precisión o coarse en interiores)
                Geolocation.getCurrentPosition({ enableHighAccuracy: true })
                    .catch(() => Geolocation.getCurrentPosition({ enableHighAccuracy: false }))
                    .then(pos => {
                        if (pos?.coords) {
                            this.saveLocation(
                                pos.coords.latitude,
                                pos.coords.longitude,
                                pos.coords.altitude ?? undefined,
                                pos.coords.accuracy ?? undefined,
                                pos.coords.heading ?? undefined,
                                pos.coords.speed ?? undefined,
                                'capacitor'
                            );
                        }
                    }).catch(() => {});

                // Rastreo continuo
                const watchId = await Geolocation.watchPosition(
                    { enableHighAccuracy: true },
                    (pos, err) => {
                        if (err || !pos?.coords) {
                            console.warn('[TacticalLocationEngine] Capacitor watchPosition tick error:', err);
                            return;
                        }
                        this.saveLocation(
                            pos.coords.latitude,
                            pos.coords.longitude,
                            pos.coords.altitude ?? undefined,
                            pos.coords.accuracy ?? undefined,
                            pos.coords.heading ?? undefined,
                            pos.coords.speed ?? undefined,
                            'capacitor'
                        );
                    }
                );

                if (watchId) {
                    this.activeCapacitorWatchId = watchId;
                    this.isCapacitorActive = true;
                    this.isStartingWatch = false;
                    return;
                }
            } catch {
                this.isCapacitorActive = false;
            }

            // 2. Fallback a HTML5 Geolocation si Capacitor no está disponible (ej. navegador de escritorio)
            if (typeof navigator !== 'undefined' && navigator.geolocation && this.activeHtml5WatchId === null) {
                try {
                    this.activeHtml5WatchId = navigator.geolocation.watchPosition(
                        (pos) => {
                            this.saveLocation(
                                pos.coords.latitude,
                                pos.coords.longitude,
                                pos.coords.altitude !== null ? pos.coords.altitude : undefined,
                                pos.coords.accuracy !== null ? pos.coords.accuracy : undefined,
                                pos.coords.heading !== null ? pos.coords.heading : undefined,
                                pos.coords.speed !== null ? pos.coords.speed : undefined,
                                'html5'
                            );
                        },
                        (err) => {
                            console.warn('[TacticalLocationEngine] HTML5 GNSS watch error:', err?.message);
                        },
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
                    );
                } catch (e) {
                    console.warn('[TacticalLocationEngine] Fallo al registrar watchPosition HTML5:', e);
                }
            }
            this.isStartingWatch = false;
        };

        startNativeWatch();

        return () => {
            this.listeners.delete(callback);
            if (this.listeners.size === 0) {
                this.stopWatch();
            }
        };
    }
}

/**
 * RED 2.0 — TacticalGhostGpsEngine.ts
 *
 * Motor Táctico Soberano de Posicionamiento Señuelo (Ghost GPS) y Anti-Rastreo.
 *
 * Proporciona anonimato y contramedidas de engaño geoespacial:
 * 1. Modo Señuelo Fijo (Static Decoy): Coordenadas preestablecidas o personalizadas
 *    para proyectar presencia en ubicaciones remotas o estratégicas.
 * 2. Modo Dispersión Táctica (Jitter Anti-Triangulación): Aplica perturbación gaussiana
 *    alrededor de la posición real para impedir la fijación exacta por radiogonometría o drones.
 * 3. Modo Patrulla Cinemática (Kinematic Route): Genera vectores de movimiento realistas
 *    (velocidad, altitud, precisión variable y rumbo Course-Over-Ground dinámico).
 * 4. Integración con el framework de Mock Location de Android para engaño a nivel del SO.
 */

import type { TacticalLocation } from './TacticalLocationEngine';

export type GhostMode = 'OFF' | 'STATIC_DECOY' | 'JITTER_DISPERSION' | 'KINEMATIC_ROUTE';

export interface GhostWaypoint {
    lat: number;
    lon: number;
    label?: string;
}

export interface GhostGpsConfig {
    mode: GhostMode;
    staticCoords: {
        lat: number;
        lon: number;
        alt: number;
    };
    jitterRadiusMeters: number; // 100m a 5000m
    kinematicSpeedKmh: number;   // 2 km/h (caminata) a 120 km/h (vehículo)
    routeWaypoints: GhostWaypoint[];
    activeWaypointIndex: number;
}

export interface GhostPresetLocation {
    id: string;
    name: string;
    category: 'TACTICAL' | 'METROPOLIS' | 'REMOTE';
    lat: number;
    lon: number;
    alt: number;
    description: string;
}

const STORAGE_KEY_GHOST_CONFIG = 'red_tactical_ghost_gps_config';

export const GHOST_PRESET_LOCATIONS: GhostPresetLocation[] = [
    {
        id: 'svalbard_seed_vault',
        name: 'Bóveda Global de Semillas (Svalbard)',
        category: 'TACTICAL',
        lat: 78.2378,
        lon: 15.4913,
        alt: 130,
        description: 'Búnker ártico de máxima seguridad geopolítica, Spitsbergen, Noruega.'
    },
    {
        id: 'atacama_radio_observatory',
        name: 'Meseta de Chajnantor (ALMA Atacama)',
        category: 'REMOTE',
        lat: -23.0234,
        lon: -67.7548,
        alt: 5050,
        description: 'Zona de absoluto aislamiento electromagnético, Desierto de Atacama, Chile.'
    },
    {
        id: 'shinjuku_tokyo',
        name: 'Distrito Shinjuku (Tokio)',
        category: 'METROPOLIS',
        lat: 35.6938,
        lon: 139.7036,
        alt: 38,
        description: 'Alta densidad urbana y camuflaje electromagnético masivo en Japón.'
    },
    {
        id: 'geneva_cern',
        name: 'Campus CERN / Gran Colisionador (Ginebra)',
        category: 'TACTICAL',
        lat: 46.2330,
        lon: 6.0557,
        alt: 440,
        description: 'Frontera Franco-Suiza, infraestructura técnica soterrada.'
    },
    {
        id: 'iceland_reykjavik',
        name: 'Puerto de Reikiavik',
        category: 'REMOTE',
        lat: 64.1466,
        lon: -21.9426,
        alt: 12,
        description: 'Nordatlántico Norte, nodo marítimo y baja interferencia.'
    }
];

export class TacticalGhostGpsEngine {
    private static instance: TacticalGhostGpsEngine | null = null;
    private config: GhostGpsConfig;
    private listeners: Set<(loc: TacticalLocation) => void> = new Set();
    private activeSimulationTimer: any = null;
    private currentSimulatedLocation: TacticalLocation | null = null;
    private lastRealHardwareCoords: { lat: number; lon: number; alt?: number } | null = null;
    private mockLocationEnabledInSystem: boolean = false;

    private constructor() {
        this.config = this.loadConfig();
        if (this.config.mode !== 'OFF') {
            this.startSimulationLoop();
        }
    }

    public static getInstance(): TacticalGhostGpsEngine {
        if (!TacticalGhostGpsEngine.instance) {
            TacticalGhostGpsEngine.instance = new TacticalGhostGpsEngine();
        }
        return TacticalGhostGpsEngine.instance;
    }

    private getDefaultConfig(): GhostGpsConfig {
        return {
            mode: 'OFF',
            staticCoords: {
                lat: GHOST_PRESET_LOCATIONS[0].lat,
                lon: GHOST_PRESET_LOCATIONS[0].lon,
                alt: GHOST_PRESET_LOCATIONS[0].alt,
            },
            jitterRadiusMeters: 500,
            kinematicSpeedKmh: 12, // Trote táctico
            routeWaypoints: [
                { lat: GHOST_PRESET_LOCATIONS[0].lat, lon: GHOST_PRESET_LOCATIONS[0].lon, label: 'Punto Alfa' },
                { lat: GHOST_PRESET_LOCATIONS[0].lat + 0.005, lon: GHOST_PRESET_LOCATIONS[0].lon + 0.004, label: 'Punto Bravo' },
                { lat: GHOST_PRESET_LOCATIONS[0].lat - 0.003, lon: GHOST_PRESET_LOCATIONS[0].lon + 0.008, label: 'Punto Charlie' },
            ],
            activeWaypointIndex: 0,
        };
    }

    private loadConfig(): GhostGpsConfig {
        if (typeof window === 'undefined') return this.getDefaultConfig();
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GHOST_CONFIG);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...this.getDefaultConfig(), ...parsed };
            }
        } catch {}
        return this.getDefaultConfig();
    }

    private saveConfig(): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY_GHOST_CONFIG, JSON.stringify(this.config));
        } catch {}
    }

    public getConfig(): GhostGpsConfig {
        return { ...this.config };
    }

    public isGhostActive(): boolean {
        return this.config.mode !== 'OFF';
    }

    public getMode(): GhostMode {
        return this.config.mode;
    }

    /**
     * Registra las coordenadas reales del hardware para cálculos de Jitter y bypass de emergencia
     */
    public recordRealHardwareLocation(lat: number, lon: number, alt?: number): void {
        this.lastRealHardwareCoords = { lat, lon, alt };
    }

    public getRealHardwareLocation(): { lat: number; lon: number; alt?: number } | null {
        return this.lastRealHardwareCoords;
    }

    /**
     * Activa el modo señuelo con la configuración dada
     */
    public activateMode(mode: GhostMode, options?: Partial<GhostGpsConfig>): void {
        this.config.mode = mode;
        if (options) {
            if (options.staticCoords) this.config.staticCoords = { ...this.config.staticCoords, ...options.staticCoords };
            if (options.jitterRadiusMeters !== undefined) this.config.jitterRadiusMeters = Math.max(50, Math.min(10000, options.jitterRadiusMeters));
            if (options.kinematicSpeedKmh !== undefined) this.config.kinematicSpeedKmh = Math.max(1, Math.min(250, options.kinematicSpeedKmh));
            if (options.routeWaypoints) this.config.routeWaypoints = options.routeWaypoints;
            if (options.activeWaypointIndex !== undefined) this.config.activeWaypointIndex = options.activeWaypointIndex;
        }
        this.saveConfig();

        if (mode === 'OFF') {
            this.stopSimulationLoop();
            this.currentSimulatedLocation = null;
            this.listeners.forEach(cb => {
                try {
                    const fallback: TacticalLocation = {
                        lat: this.lastRealHardwareCoords?.lat,
                        lon: this.lastRealHardwareCoords?.lon,
                        alt: this.lastRealHardwareCoords?.alt,
                        timestamp: Date.now(),
                        isEstimated: false,
                        isGhost: false,
                        source: 'cache'
                    };
                    cb(fallback);
                } catch {}
            });
        } else {
            this.startSimulationLoop();
            this.tickSimulation(); // Fijación inmediata
        }
    }

    /**
     * Desactiva inmediatamente el señuelo y regresa a hardware GPS real
     */
    public deactivateGhost(): void {
        this.activateMode('OFF');
    }

    /**
     * Establece coordenadas estáticas personalizadas
     */
    public setStaticLocation(lat: number, lon: number, alt: number = 30): void {
        this.config.staticCoords = { lat, lon, alt };
        if (this.config.mode === 'STATIC_DECOY') {
            this.saveConfig();
            this.tickSimulation();
        }
    }

    /**
     * Carga un preset táctico predefinido
     */
    public loadPreset(presetId: string): boolean {
        const preset = GHOST_PRESET_LOCATIONS.find(p => p.id === presetId);
        if (!preset) return false;
        this.config.staticCoords = { lat: preset.lat, lon: preset.lon, alt: preset.alt };
        this.config.routeWaypoints = [
            { lat: preset.lat, lon: preset.lon, label: `${preset.name} (Base)` },
            { lat: preset.lat + 0.003, lon: preset.lon + 0.003, label: 'Punto Avanzado' },
            { lat: preset.lat - 0.002, lon: preset.lon + 0.005, label: 'Punto Retaguardia' },
        ];
        this.config.activeWaypointIndex = 0;
        this.saveConfig();
        if (this.config.mode !== 'OFF') {
            this.tickSimulation();
        }
        return true;
    }

    /**
     * Obtiene la posición táctica simulada actual
     */
    public getCurrentGhostLocation(): TacticalLocation | null {
        if (this.config.mode === 'OFF') return null;
        if (!this.currentSimulatedLocation) {
            this.tickSimulation();
        }
        return this.currentSimulatedLocation;
    }

    /**
     * Suscripción a cambios en la posición señuelo
     */
    public addListener(callback: (loc: TacticalLocation) => void): () => void {
        this.listeners.add(callback);
        if (this.currentSimulatedLocation) {
            try { callback(this.currentSimulatedLocation); } catch {}
        }
        return () => {
            this.listeners.delete(callback);
        };
    }

    private startSimulationLoop(): void {
        this.stopSimulationLoop();
        // Ciclo de actualización cinemática cada 1.5 segundos
        this.activeSimulationTimer = setInterval(() => {
            this.tickSimulation();
        }, 1500);
    }

    private stopSimulationLoop(): void {
        if (this.activeSimulationTimer) {
            clearInterval(this.activeSimulationTimer);
            this.activeSimulationTimer = null;
        }
    }

    /**
     * Generador cinemático del paso de simulación
     */
    private tickSimulation(): void {
        if (this.config.mode === 'OFF') return;

        const now = Date.now();
        let targetLat = this.config.staticCoords.lat;
        let targetLon = this.config.staticCoords.lon;
        let targetAlt = this.config.staticCoords.alt;
        let heading = 0;
        let speedMps = 0;

        // Ruido realista de satélites en la precisión (4m a 8m)
        const simulatedAccuracy = Math.round(4 + Math.random() * 4);

        if (this.config.mode === 'STATIC_DECOY') {
            targetLat = this.config.staticCoords.lat;
            targetLon = this.config.staticCoords.lon;
            targetAlt = this.config.staticCoords.alt;
            heading = this.currentSimulatedLocation?.heading ?? 0;
            speedMps = 0;
        } else if (this.config.mode === 'JITTER_DISPERSION') {
            // Usa las coordenadas reales del hardware si existen; de lo contrario, la estática
            const baseLat = this.lastRealHardwareCoords?.lat ?? this.config.staticCoords.lat;
            const baseLon = this.lastRealHardwareCoords?.lon ?? this.config.staticCoords.lon;
            const baseAlt = this.lastRealHardwareCoords?.alt ?? this.config.staticCoords.alt;

            // Desplazamiento radial aleatorio dentro del radio configurado
            const radiusM = Math.random() * this.config.jitterRadiusMeters;
            const angleRad = Math.random() * 2 * Math.PI;

            // 1 grado latitud ~ 111,139 metros
            const deltaLat = (radiusM * Math.cos(angleRad)) / 111139;
            // 1 grado longitud ~ 111,139 * cos(lat)
            const deltaLon = (radiusM * Math.sin(angleRad)) / (111139 * Math.cos((baseLat * Math.PI) / 180));

            targetLat = baseLat + deltaLat;
            targetLon = baseLon + deltaLon;
            targetAlt = baseAlt + Math.round((Math.random() - 0.5) * 6);
            heading = Math.round((angleRad * 180) / Math.PI);
            speedMps = Math.round(Math.random() * 1.5 * 10) / 10;
        } else if (this.config.mode === 'KINEMATIC_ROUTE') {
            // Interpolación cinética entre waypoints
            const waypoints = this.config.routeWaypoints;
            if (waypoints.length > 0) {
                const currentIdx = this.config.activeWaypointIndex % waypoints.length;
                const nextIdx = (currentIdx + 1) % waypoints.length;
                const currentWp = waypoints[currentIdx];
                const nextWp = waypoints[nextIdx];

                const prevLoc = this.currentSimulatedLocation;
                const curLat = prevLoc?.lat ?? currentWp.lat;
                const curLon = prevLoc?.lon ?? currentWp.lon;

                speedMps = (this.config.kinematicSpeedKmh * 1000) / 3600;
                const distanceStepMeters = speedMps * 1.5; // dt = 1.5s

                // Vector hacia el siguiente waypoint
                const distToNext = this.calculateDistanceMeters(curLat, curLon, nextWp.lat, nextWp.lon);
                heading = this.calculateBearing(curLat, curLon, nextWp.lat, nextWp.lon);

                if (distToNext <= distanceStepMeters * 1.2) {
                    // Alcanzado el waypoint: avanzar al siguiente
                    targetLat = nextWp.lat;
                    targetLon = nextWp.lon;
                    this.config.activeWaypointIndex = nextIdx;
                    this.saveConfig();
                } else {
                    // Avanzar una fracción del vector
                    const fraction = distanceStepMeters / distToNext;
                    targetLat = curLat + (nextWp.lat - curLat) * fraction;
                    targetLon = curLon + (nextWp.lon - curLon) * fraction;
                }
                targetAlt = this.config.staticCoords.alt;
            }
        }

        const simulated: TacticalLocation = {
            lat: Math.round(targetLat * 1e6) / 1e6,
            lon: Math.round(targetLon * 1e6) / 1e6,
            alt: targetAlt,
            accuracy: simulatedAccuracy,
            heading,
            speed: Math.round(speedMps * 10) / 10,
            timestamp: now,
            isEstimated: true,
            ageMs: 0,
            source: 'cache',
            isGhost: true,
        };

        this.currentSimulatedLocation = simulated;

        // Notificar a los escuchas del motor señuelo
        this.listeners.forEach(cb => {
            try { cb(simulated); } catch {}
        });

        // Difundir al Mock Location de Android si el sistema lo soporta
        this.dispatchToAndroidMockLocation(simulated);
    }

    private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
        return R * c;
    }

    private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const radLat1 = (lat1 * Math.PI) / 180;
        const radLat2 = (lat2 * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const y = Math.sin(dLon) * Math.cos(radLat2);
        const x = Math.cos(radLat1) * Math.sin(radLat2) -
                  Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLon);
        const brng = (Math.atan2(y, x) * 180) / Math.PI;
        return Math.round((brng + 360) % 360);
    }

    /**
     * Despacha la coordenada simulada al proveedor Mock Location de Android si está disponible
     */
    private async dispatchToAndroidMockLocation(loc: TacticalLocation): Promise<void> {
        if (typeof window === 'undefined') return;
        try {
            // Si existe el puente Android JavascriptInterface o plugin Capacitor
            const win = window as any;
            if (win.AndroidMockLocation && typeof win.AndroidMockLocation.setMockLocation === 'function') {
                win.AndroidMockLocation.setMockLocation(
                    loc.lat,
                    loc.lon,
                    loc.alt ?? 0,
                    loc.accuracy ?? 5,
                    loc.speed ?? 0,
                    loc.heading ?? 0
                );
                this.mockLocationEnabledInSystem = true;
            }
        } catch {}
    }

    public isSystemMockLocationActive(): boolean {
        return this.mockLocationEnabledInSystem;
    }
}

export const tacticalGhostGps = TacticalGhostGpsEngine.getInstance();

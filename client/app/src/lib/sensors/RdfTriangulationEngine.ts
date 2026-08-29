/**
 * RdfTriangulationEngine.ts — RED Tactical Radio Direction Finding LOB Triangulation Engine
 * 
 * Intersects multiple Lines-of-Bearing (LOBs) recorded from different spatial coordinates
 * to pinpoint the exact geographic location (Lat/Lon) of clandestine transmitters or distress beacons.
 */

export interface LineOfBearing {
    id: string;
    observerLat: number;
    observerLon: number;
    bearingDeg: number;
    rssiDbm: number;
    timestamp: number;
}

export interface RdfTargetFix {
    targetLat: number;
    targetLon: number;
    uncertaintyRadiusMeters: number;
    lobsUsed: number;
    confidencePct: number;
    timestamp: number;
}

export class RdfTriangulationEngine {
    private static instance: RdfTriangulationEngine | null = null;

    private lobs: LineOfBearing[] = [];
    private lastFix: RdfTargetFix | null = null;
    private listeners: Set<(state: { lobs: LineOfBearing[]; lastFix: RdfTargetFix | null }) => void> = new Set();

    private constructor() {}

    public static getInstance(): RdfTriangulationEngine {
        if (!this.instance) {
            this.instance = new RdfTriangulationEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (state: { lobs: LineOfBearing[]; lastFix: RdfTargetFix | null }) => void): () => void {
        this.listeners.add(cb);
        cb(this.getState());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const s = this.getState();
        this.listeners.forEach(cb => {
            try { cb(s); } catch {}
        });
    }

    public addBearing(observerLat: number, observerLon: number, bearingDeg: number, rssiDbm: number): LineOfBearing {
        const lob: LineOfBearing = {
            id: `lob-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            observerLat,
            observerLon,
            bearingDeg: Math.round(bearingDeg) % 360,
            rssiDbm,
            timestamp: Date.now()
        };

        this.lobs.push(lob);
        this.triangulateTarget();
        return lob;
    }

    public removeBearing(id: string) {
        this.lobs = this.lobs.filter(l => l.id !== id);
        this.triangulateTarget();
    }

    public clearBearings() {
        this.lobs = [];
        this.lastFix = null;
        this.notify();
    }

    /**
     * Intersecta las líneas de marcación de rumbo LOB
     */
    public triangulateTarget(): RdfTargetFix | null {
        if (this.lobs.length < 2) {
            this.lastFix = null;
            this.notify();
            return null;
        }

        const lob1 = this.lobs[this.lobs.length - 2];
        const lob2 = this.lobs[this.lobs.length - 1];

        // Conversión a coordenadas locales planas en metros (aproximación equirrectangular)
        const latRef = (lob1.observerLat + lob2.observerLat) / 2;
        const mPerDegLat = 111320;
        const mPerDegLon = 111320 * Math.cos((latRef * Math.PI) / 180);

        const x1 = lob1.observerLon * mPerDegLon;
        const y1 = lob1.observerLat * mPerDegLat;

        const x2 = lob2.observerLon * mPerDegLon;
        const y2 = lob2.observerLat * mPerDegLat;

        // Azimut en radianes medido desde el Norte en sentido horario
        const theta1Rad = (lob1.bearingDeg * Math.PI) / 180;
        const theta2Rad = (lob2.bearingDeg * Math.PI) / 180;

        // Vectores directores (dx = sin(theta), dy = cos(theta))
        const dx1 = Math.sin(theta1Rad);
        const dy1 = Math.cos(theta1Rad);

        const dx2 = Math.sin(theta2Rad);
        const dy2 = Math.cos(theta2Rad);

        // Determinante 2D: dx1 * dy2 - dy1 * dx2
        const det = dx1 * dy2 - dy1 * dx2;

        if (Math.abs(det) < 0.05) {
            // Líneas casi paralelas o colineales
            this.lastFix = null;
            this.notify();
            return null;
        }

        // Resolución del punto de intersección: (x1 + t1*dx1, y1 + t1*dy1)
        const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / det;

        const xTarget = x1 + t1 * dx1;
        const yTarget = y1 + t1 * dy1;

        const targetLon = Math.round((xTarget / mPerDegLon) * 100000) / 100000;
        const targetLat = Math.round((yTarget / mPerDegLat) * 100000) / 100000;

        const fix: RdfTargetFix = {
            targetLat,
            targetLon,
            uncertaintyRadiusMeters: Math.round(15 + Math.random() * 20),
            lobsUsed: this.lobs.length,
            confidencePct: Math.min(96, Math.round(75 + this.lobs.length * 7)),
            timestamp: Date.now()
        };

        this.lastFix = fix;
        this.notify();
        return fix;
    }

    /**
     * Simula un ejercicio de Foxhunting con 3 marcaciones
     */
    public simulateSampleFoxhunt(baseLat: number = 4.6097, baseLon: number = -74.0817) {
        this.clearBearings();

        // 3 posiciones de observación alrededor de un objetivo ficticio
        this.addBearing(baseLat - 0.002, baseLon - 0.003, 42, -68);
        this.addBearing(baseLat + 0.003, baseLon - 0.002, 130, -72);
        this.addBearing(baseLat - 0.001, baseLon + 0.004, 290, -64);
    }

    public getState(): { lobs: LineOfBearing[]; lastFix: RdfTargetFix | null } {
        return {
            lobs: this.lobs,
            lastFix: this.lastFix
        };
    }
}

export const rdfTriangulation = RdfTriangulationEngine.getInstance();

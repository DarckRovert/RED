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
     * Intersecta las líneas de marcación de rumbo LOB mediante promedio ponderado multi-nodo
     */
    public triangulateTarget(): RdfTargetFix | null {
        if (this.lobs.length < 2) {
            this.lastFix = null;
            this.notify();
            return null;
        }

        const intersections: Array<{ x: number; y: number; weight: number }> = [];

        // Referencia central
        const latRef = this.lobs.reduce((acc, l) => acc + l.observerLat, 0) / this.lobs.length;
        const mPerDegLat = 111320;
        const mPerDegLon = 111320 * Math.cos((latRef * Math.PI) / 180);

        // Evaluar todos los pares de líneas de marcación
        for (let i = 0; i < this.lobs.length - 1; i++) {
            for (let j = i + 1; j < this.lobs.length; j++) {
                const lob1 = this.lobs[i];
                const lob2 = this.lobs[j];

                const x1 = lob1.observerLon * mPerDegLon;
                const y1 = lob1.observerLat * mPerDegLat;
                const x2 = lob2.observerLon * mPerDegLon;
                const y2 = lob2.observerLat * mPerDegLat;

                const theta1Rad = (lob1.bearingDeg * Math.PI) / 180;
                const theta2Rad = (lob2.bearingDeg * Math.PI) / 180;

                const dx1 = Math.sin(theta1Rad);
                const dy1 = Math.cos(theta1Rad);
                const dx2 = Math.sin(theta2Rad);
                const dy2 = Math.cos(theta2Rad);

                const det = dx1 * dy2 - dy1 * dx2;
                if (Math.abs(det) < 0.05) continue; // Líneas casi paralelas

                const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / det;
                const t2 = ((x2 - x1) * dy1 - (y2 - y1) * dx1) / det;

                // Solo intersecciones en la dirección de propagación (t1 > 0 y t2 > 0)
                if (t1 > 0 && t2 > 0) {
                    const weight = Math.abs(det); // Mayor ángulo de corte = mayor certidumbre geométrica
                    intersections.push({
                        x: x1 + t1 * dx1,
                        y: y1 + t1 * dy1,
                        weight,
                    });
                }
            }
        }

        if (intersections.length === 0) {
            // Fallback al último par disponible
            const lob1 = this.lobs[this.lobs.length - 2];
            const lob2 = this.lobs[this.lobs.length - 1];
            const x1 = lob1.observerLon * mPerDegLon;
            const y1 = lob1.observerLat * mPerDegLat;
            const x2 = lob2.observerLon * mPerDegLon;
            const y2 = lob2.observerLat * mPerDegLat;
            const theta1Rad = (lob1.bearingDeg * Math.PI) / 180;
            const theta2Rad = (lob2.bearingDeg * Math.PI) / 180;
            const dx1 = Math.sin(theta1Rad);
            const dy1 = Math.cos(theta1Rad);
            const dx2 = Math.sin(theta2Rad);
            const dy2 = Math.cos(theta2Rad);
            const det = dx1 * dy2 - dy1 * dx2;
            if (Math.abs(det) >= 0.02) {
                const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / det;
                intersections.push({ x: x1 + t1 * dx1, y: y1 + t1 * dy1, weight: 1 });
            }
        }

        if (intersections.length === 0) {
            this.lastFix = null;
            this.notify();
            return null;
        }

        let totalWeight = 0;
        let avgX = 0;
        let avgY = 0;
        for (const p of intersections) {
            avgX += p.x * p.weight;
            avgY += p.y * p.weight;
            totalWeight += p.weight;
        }
        avgX /= totalWeight;
        avgY /= totalWeight;

        // Radio de dispersión e incertidumbre geométrica
        let maxDist = 15;
        for (const p of intersections) {
            const d = Math.sqrt((p.x - avgX) ** 2 + (p.y - avgY) ** 2);
            if (d > maxDist) maxDist = d;
        }

        const targetLon = Math.round((avgX / mPerDegLon) * 100000) / 100000;
        const targetLat = Math.round((avgY / mPerDegLat) * 100000) / 100000;

        const fix: RdfTargetFix = {
            targetLat,
            targetLon,
            uncertaintyRadiusMeters: Math.round(Math.min(500, maxDist)),
            lobsUsed: this.lobs.length,
            confidencePct: Math.min(98, Math.round(70 + Math.min(this.lobs.length, 5) * 6)),
            timestamp: Date.now()
        };

        this.lastFix = fix;
        this.notify();
        return fix;
    }

    public getState(): { lobs: LineOfBearing[]; lastFix: RdfTargetFix | null } {
        return {
            lobs: this.lobs,
            lastFix: this.lastFix
        };
    }
}

export const rdfTriangulation = RdfTriangulationEngine.getInstance();

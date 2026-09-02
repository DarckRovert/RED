/**
 * SitrepEngine.ts — RED Tactical Situation Report (SITREP) & Force Status Engine
 * 
 * Aggregates standardized NATO / TCCC field situation reports, casualty triage counts,
 * ammo/medical/battery logistics, and propagates summarized payloads across the mesh.
 */

export interface CasualtiesTccc {
    t1ImmediateRed: number;
    t2DelayedYellow: number;
    t3MinimalGreen: number;
    t4ExpectantBlack: number;
}

export interface SitrepReport {
    id: string;
    timestamp: number;
    unitCallsign: string;
    operatorName: string;
    location: { lat: number; lon: number; gridUtm?: string };
    threatStatus: 'GREEN_CLEAR' | 'AMBER_SUSPICIOUS' | 'RED_CONTACT';
    friendlyTroopsCount: number;
    casualties: CasualtiesTccc;
    suppliesAmmoPct: number;
    suppliesMedicalPct: number;
    suppliesBatteryPct: number;
    remarks: string;
}

const STORAGE_SITREPS_KEY = 'red_tactical_sitreps_v1';

export class SitrepEngine {
    private static instance: SitrepEngine | null = null;
    private sitreps: SitrepReport[] = [];
    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadSitreps();
        }
    }

    public static getInstance(): SitrepEngine {
        if (!this.instance) {
            this.instance = new SitrepEngine();
        }
        return this.instance;
    }

    public subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(); } catch {}
        });
    }

    private loadSitreps() {
        try {
            const raw = localStorage.getItem(STORAGE_SITREPS_KEY);
            if (raw) {
                this.sitreps = JSON.parse(raw);
            }
        } catch (e) {
            console.error('[SitrepEngine] Error loading sitreps:', e);
        }
    }

    private saveSitreps() {
        try {
            localStorage.setItem(STORAGE_SITREPS_KEY, JSON.stringify(this.sitreps));
            this.notify();
        } catch (e) {
            console.error('[SitrepEngine] Error saving sitreps:', e);
        }
    }

    public createSitrep(report: Omit<SitrepReport, 'id' | 'timestamp'>): SitrepReport {
        const fullReport: SitrepReport = {
            ...report,
            id: `SITREP-${Date.now().toString(36).toUpperCase()}`,
            timestamp: Date.now(),
        };

        this.sitreps.unshift(fullReport);
        if (this.sitreps.length > 50) {
            this.sitreps.pop();
        }

        this.saveSitreps();
        return fullReport;
    }

    public getLatestSitrep(): SitrepReport | null {
        return this.sitreps.length > 0 ? this.sitreps[0] : null;
    }

    public getSitreps(): SitrepReport[] {
        return [...this.sitreps];
    }

    public exportFormattedText(report: SitrepReport): string {
        let dateStr = '';
        try {
            const validTime = (typeof report.timestamp === 'number' && isFinite(report.timestamp))
                ? report.timestamp
                : Date.now();
            dateStr = new Date(validTime).toISOString();
        } catch {
            dateStr = new Date().toISOString();
        }

        const safeLat = (typeof report.location?.lat === 'number' && isFinite(report.location.lat))
            ? report.location.lat.toFixed(5)
            : '0.00000';
        const safeLon = (typeof report.location?.lon === 'number' && isFinite(report.location.lon))
            ? report.location.lon.toFixed(5)
            : '0.00000';

        const casualties = report.casualties || {
            t1ImmediateRed: 0,
            t2DelayedYellow: 0,
            t3MinimalGreen: 0,
            t4ExpectantBlack: 0,
        };

        return [
            `═══════════════════════════════════════════`,
            `  SITUATION REPORT (SITREP) // RED TACTICAL`,
            `  ID: ${report.id} | FECHA: ${dateStr}`,
            `═══════════════════════════════════════════`,
            `1. UNIDAD / INDICATIVO : ${report.unitCallsign || 'DESCONOCIDO'} (${report.operatorName || 'OPERADOR'})`,
            `2. COORDENADAS GPS     : ${safeLat}°, ${safeLon}°`,
            `3. ESTADO DE AMENAZA   : ${report.threatStatus || 'GREEN_CLEAR'}`,
            `4. EFECTIVOS ACTIVOS   : ${report.friendlyTroopsCount || 0} Operadores`,
            `5. BAJAS TRIAGE TCCC   :`,
            `   - T1 INMEDIATO (ROJO)   : ${casualties.t1ImmediateRed}`,
            `   - T2 RETARDADO (AMAR)   : ${casualties.t2DelayedYellow}`,
            `   - T3 LEVE (VERDE)       : ${casualties.t3MinimalGreen}`,
            `   - T4 FALLECIDOS (NEGRO) : ${casualties.t4ExpectantBlack}`,
            `6. LOGÍSTICA & NIVELES :`,
            `   - Munición : ${report.suppliesAmmoPct ?? 100}%`,
            `   - Médico   : ${report.suppliesMedicalPct ?? 100}%`,
            `   - Batería  : ${report.suppliesBatteryPct ?? 100}%`,
            `7. OBSERVACIONES       : ${report.remarks || 'Sin novedades'}`,
            `═══════════════════════════════════════════`
        ].join('\n');
    }

    public destroy(): void {
        this.sitreps = [];
        this.listeners.clear();
        SitrepEngine.instance = null;
    }
}

export const sitrepEngine = SitrepEngine.getInstance();

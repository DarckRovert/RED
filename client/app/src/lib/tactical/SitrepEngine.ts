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
        const dateStr = new Date(report.timestamp).toISOString();
        return [
            `═══════════════════════════════════════════`,
            `  SITUATION REPORT (SITREP) // RED TACTICAL`,
            `  ID: ${report.id} | FECHA: ${dateStr}`,
            `═══════════════════════════════════════════`,
            `1. UNIDAD / INDICATIVO : ${report.unitCallsign} (${report.operatorName})`,
            `2. COORDENADAS GPS     : ${report.location.lat.toFixed(5)}°, ${report.location.lon.toFixed(5)}°`,
            `3. ESTADO DE AMENAZA   : ${report.threatStatus}`,
            `4. EFECTIVOS ACTIVOS   : ${report.friendlyTroopsCount} Operadores`,
            `5. BAJAS TRIAGE TCCC   :`,
            `   - T1 INMEDIATO (ROJO)   : ${report.casualties.t1ImmediateRed}`,
            `   - T2 RETARDADO (AMAR)   : ${report.casualties.t2DelayedYellow}`,
            `   - T3 LEVE (VERDE)       : ${report.casualties.t3MinimalGreen}`,
            `   - T4 FALLECIDOS (NEGRO) : ${report.casualties.t4ExpectantBlack}`,
            `6. LOGÍSTICA & NIVELES :`,
            `   - Munición : ${report.suppliesAmmoPct}%`,
            `   - Médico   : ${report.suppliesMedicalPct}%`,
            `   - Batería  : ${report.suppliesBatteryPct}%`,
            `7. OBSERVACIONES       : ${report.remarks || 'Sin novedades'}`,
            `═══════════════════════════════════════════`
        ].join('\n');
    }

    public destroy(): void {
        this.listeners.clear();
    }
}

export const sitrepEngine = SitrepEngine.getInstance();

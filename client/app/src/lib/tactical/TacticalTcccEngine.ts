/**
 * TacticalTcccEngine.ts — RED Tactical Combat Casualty Care (TCCC) & MARCH-PAWS Triage Engine
 * 
 * Implements the standard military MARCH-PAWS protocol with active tourniquet time-tracking (ischemia alert at 120 min),
 * emergency airway/respiration interventions, and standardized DD Form 1380 Casualty Card generation for mesh SOS broadcast.
 */

export type LimbLocation = 'RIGHT_ARM' | 'LEFT_ARM' | 'RIGHT_LEG' | 'LEFT_LEG';
export type EvacPriority = 'URGENT' | 'PRIORITY' | 'ROUTINE';

export interface TourniquetRecord {
    id: string;
    limb: LimbLocation;
    appliedTimestamp: number;
    elapsedMinutes: number;
    type: 'CAT_GEN7' | 'SOFTT_W' | 'SAM_XT';
    isIschemicAlert: boolean; // >= 120 minutos
}

export interface TcccCasualtyCard {
    id: string;
    casualtyName: string;
    rosterNumber: string;
    evacPriority: EvacPriority;
    massiveBleedingControlled: boolean;
    tourniquets: TourniquetRecord[];
    airwayStatus: 'INTACT' | 'NPA_APPLIED' | 'CRICOTHYROIDOTOMY' | 'RECOVERY_POSITION';
    respirationStatus: 'NORMAL' | 'VENTED_CHEST_SEAL' | 'NEEDLE_DECOMPRESSION_14G';
    circulationPulsePresent: boolean;
    txaAdministered: boolean;
    hypothermiaCoverApplied: boolean;
    painMedication: string;
    antibioticsGiven: boolean;
    splintApplied: boolean;
    createdTimestamp: number;
}

export class TacticalTcccEngine {
    private static instance: TacticalTcccEngine | null = null;

    private activeTourniquets: TourniquetRecord[] = [];
    private casualtyCards: TcccCasualtyCard[] = [];
    private tickerInterval: any = null;

    private listeners: Set<(tourniquets: TourniquetRecord[]) => void> = new Set();

    private constructor() {
        this.startTicker();
    }

    public static getInstance(): TacticalTcccEngine {
        if (!this.instance) {
            this.instance = new TacticalTcccEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: TourniquetRecord[]) => void): () => void {
        this.listeners.add(cb);
        cb(this.getActiveTourniquets());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const t = this.getActiveTourniquets();
        this.listeners.forEach(cb => {
            try { cb(t); } catch {}
        });
    }

    private startTicker() {
        this.tickerInterval = setInterval(() => {
            const now = Date.now();
            let changed = false;

            this.activeTourniquets.forEach(tq => {
                const mins = Math.max(0, Math.floor((now - tq.appliedTimestamp) / 60000));
                if (mins !== tq.elapsedMinutes) {
                    tq.elapsedMinutes = mins;
                    tq.isIschemicAlert = mins >= 120;
                    changed = true;
                }
            });

            if (changed) this.notify();
        }, 5000);
    }

    public applyTourniquet(limb: LimbLocation, type: 'CAT_GEN7' | 'SOFTT_W' | 'SAM_XT' = 'CAT_GEN7'): TourniquetRecord {
        const randSuffix = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(2))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
            : (Date.now() % 10000).toString(16).toUpperCase();
        const tq: TourniquetRecord = {
            id: `TQ-${Date.now().toString(36).toUpperCase()}-${randSuffix}`,
            limb,
            appliedTimestamp: Date.now(),
            elapsedMinutes: 0,
            type,
            isIschemicAlert: false,
        };

        this.activeTourniquets.push(tq);
        this.notify();
        return tq;
    }

    public removeTourniquet(id: string) {
        this.activeTourniquets = this.activeTourniquets.filter(t => t.id !== id);
        this.notify();
    }

    public getActiveTourniquets(): TourniquetRecord[] {
        return [...this.activeTourniquets];
    }

    /**
     * Genera la Tarjeta de Bajas TCCC (DD Form 1380) en formato estandarizado militar
     */
    public generateDdForm1380(card: TcccCasualtyCard): string {
        const tqStr = card.tourniquets && card.tourniquets.length > 0 
            ? card.tourniquets.map(t => `${t.limb} (${t.type}) - ${t.elapsedMinutes}min`).join(' | ') 
            : 'NINGUNO';

        const validTimestamp = (typeof card.createdTimestamp === 'number' && isFinite(card.createdTimestamp))
            ? card.createdTimestamp
            : Date.now();
        let timeIso = '';
        try {
            timeIso = new Date(validTimestamp).toISOString();
        } catch {
            timeIso = new Date().toISOString();
        }

        return `=== DD FORM 1380 — TARJETA DE BAJA TCCC ===
FECHA/HORA : ${timeIso}
ROSTER ID  : ${card.rosterNumber || 'DESCONOCIDO'} · NOMBRE: ${card.casualtyName || 'DESCONOCIDO'}
PRIORIDAD  : [ ${card.evacPriority || 'ROUTINE'} ]

[M] HEMORRAGIA MASIVA: ${card.massiveBleedingControlled ? 'CONTROLADA' : 'ACTIVA'}
    TORNIQUETES : ${tqStr}
[A] VÍA AÉREA   : ${card.airwayStatus || 'INTACT'}
[R] RESPIRACIÓN : ${card.respirationStatus || 'NORMAL'}
[C] CIRCULACIÓN : Pulso: ${card.circulationPulsePresent ? 'PRESENTE' : 'AUSENTE'} | TXA: ${card.txaAdministered ? 'SÍ (1g IV/IO)' : 'NO'}
[H] HIPOTERMIA  : Manta térmica: ${card.hypothermiaCoverApplied ? 'APLICADA' : 'PENDIENTE'}
[P] ANALGESIA   : ${card.painMedication || 'NINGUNA'}
[A] ANTIBIÓTICO : ${card.antibioticsGiven ? 'ADMINISTRADO' : 'NO'}
[W] HERIDAS     : Vendaje compresivo aplicado
[S] FÉRULAS     : ${card.splintApplied ? 'FRACTURA INMOVILIZADA' : 'N/A'}
=================================================`;
    }

    public destroy(): void {
        if (this.tickerInterval) {
            clearInterval(this.tickerInterval);
            this.tickerInterval = null;
        }
        this.activeTourniquets = [];
        this.casualtyCards = [];
        this.listeners.clear();
        TacticalTcccEngine.instance = null;
    }
}

export const tacticalTccc = TacticalTcccEngine.getInstance();

/**
 * C4isrTacticalMatrixEngine.ts — RED Unified C4ISR Tactical Theater Aggregator
 * 
 * Command, Control, Communications, Computers, Intelligence, Surveillance, and Reconnaissance.
 * Aggregates state across all tactical subsystems into a unified military situation awareness matrix.
 */

import { globalShield } from '../network/GlobalShieldEngine';
import { dynamicBearerGovernor } from '../mesh/DynamicBearerGovernor';
import { rfSigintWatchdog } from '../sensors/RfSigintWatchdogEngine';
import { cbrnRadiation } from '../sensors/CbrnRadiationEngine';
import { tacticalTccc } from './TacticalTcccEngine';
import { forensicBlackBox } from '../security/ForensicBlackBoxEngine';
import { meshSosBeacon } from '../emergency/MeshSosBeaconEngine';

export interface C4isrSnapshot {
    timestamp: number;
    // C4: Command, Control, Communications, Computers
    defconLevel: number;
    primaryBearer: string;
    isElectronicWarfareActive: boolean;
    activeSosCount: number;
    blackBoxEventsLogged: number;

    // ISR: Intelligence, Surveillance, Reconnaissance
    droneThreatLevel: string;
    radiationRateUsVh: number;
    radiationThreatLevel: string;

    // Combat & Medical Triage
    activeTourniquetsCount: number;
    hasIschemicAlert: boolean;
}

export class C4isrTacticalMatrixEngine {
    private static instance: C4isrTacticalMatrixEngine | null = null;

    private constructor() {}

    public static getInstance(): C4isrTacticalMatrixEngine {
        if (!this.instance) {
            this.instance = new C4isrTacticalMatrixEngine();
        }
        return this.instance;
    }

    public getSnapshot(): C4isrSnapshot {
        let defconLevel = 5;
        let primaryBearer = 'OFFLINE_MESH';
        let isElectronicWarfareActive = false;
        let activeSosCount = 0;
        let blackBoxEventsLogged = 0;
        let droneThreatLevel = 'CLEAR';
        let radiationRateUsVh = 0.12;
        let radiationThreatLevel = 'BACKGROUND_NORMAL';
        let activeTourniquetsCount = 0;
        let hasIschemicAlert = false;

        try {
            const shield = globalShield.getTelemetry();
            if (shield && typeof shield.currentDefcon === 'number' && isFinite(shield.currentDefcon)) {
                defconLevel = shield.currentDefcon;
            }
        } catch {}

        try {
            const swarm = dynamicBearerGovernor.getTelemetry();
            if (swarm) {
                primaryBearer = swarm.primaryBearer || 'OFFLINE_MESH';
                isElectronicWarfareActive = !!swarm.isElectronicWarfareActive;
            }
        } catch {}

        try {
            const sigint = rfSigintWatchdog.getTelemetry();
            if (sigint && sigint.threatLevel) {
                droneThreatLevel = String(sigint.threatLevel);
            }
        } catch {}

        try {
            const rad = cbrnRadiation.getTelemetry();
            if (rad) {
                radiationRateUsVh = (typeof rad.doseRateUsVh === 'number' && isFinite(rad.doseRateUsVh))
                    ? rad.doseRateUsVh
                    : 0.12;
                radiationThreatLevel = String(rad.threatLevel || 'BACKGROUND_NORMAL');
            }
        } catch {}

        try {
            const tqs = tacticalTccc.getActiveTourniquets();
            if (Array.isArray(tqs)) {
                activeTourniquetsCount = tqs.length;
                hasIschemicAlert = tqs.some(t => t && t.isIschemicAlert);
            }
        } catch {}

        try {
            const bb = forensicBlackBox.getEvents();
            if (Array.isArray(bb)) {
                blackBoxEventsLogged = bb.length;
            }
        } catch {}

        try {
            const count = meshSosBeacon.getActiveDistressCount();
            if (typeof count === 'number' && isFinite(count)) {
                activeSosCount = count;
            }
        } catch {}

        return {
            timestamp: Date.now(),
            defconLevel,
            primaryBearer,
            isElectronicWarfareActive,
            activeSosCount,
            blackBoxEventsLogged,

            droneThreatLevel,
            radiationRateUsVh,
            radiationThreatLevel,

            activeTourniquetsCount,
            hasIschemicAlert,
        };
    }

    /**
     * Genera el informe ejecutivo militar C4ISR consolidado
     */
    public generateExecutiveReport(): string {
        const s = this.getSnapshot();
        let dateStr = 'DESCONOCIDA';
        try {
            dateStr = (typeof s.timestamp === 'number' && isFinite(s.timestamp))
                ? new Date(s.timestamp).toISOString()
                : new Date().toISOString();
        } catch {
            dateStr = new Date().toISOString();
        }

        return `══════════════════════════════════════════════════════
     RED C4ISR THEATER OF OPERATIONS EXECUTIVE REPORT
══════════════════════════════════════════════════════
FECHA/HORA : ${dateStr}

[1. C4 — MANDO, CONTROL Y TELECOMUNICACIONES]
  • Estado DEFCON       : DEFCON ${s.defconLevel}
  • Portador Primario   : ${s.primaryBearer}
  • Guerra Electrónica  : ${s.isElectronicWarfareActive ? '🚨 EW INTERFERENCE DETECTADA' : '✓ ESPECTRO LIMPIO'}
  • Balizas SOS Activas : ${s.activeSosCount}
  • Registros Caja Negra: ${s.blackBoxEventsLogged} eventos inmutables SHA-256

[2. ISR — INTELIGENCIA, VIGILANCIA Y RECONOCIMIENTO]
  • Amenaza Aérea C-UAS : [ ${s.droneThreatLevel} ]
  • Dosimetría CBRN     : ${s.radiationRateUsVh} µSv/h [ ${s.radiationThreatLevel} ]

[3. COMBATE Y SANIDAD MILITAR TCCC]
  • Torniquetes Activos : ${s.activeTourniquetsCount}
  • Alerta de Isquemia  : ${s.hasIschemicAlert ? '⚠️ URGENTE: RETIRO REQUERIDO (>=120 min)' : '✓ DENTRO DE LÍMITE'}
══════════════════════════════════════════════════════`;
    }

    public destroy(): void {
        C4isrTacticalMatrixEngine.instance = null;
    }
}

export const c4isrMatrix = C4isrTacticalMatrixEngine.getInstance();

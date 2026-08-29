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
        const shield = globalShield.getTelemetry();
        const swarm = dynamicBearerGovernor.getTelemetry();
        const sigint = rfSigintWatchdog.getTelemetry();
        const rad = cbrnRadiation.getTelemetry();
        const tqs = tacticalTccc.getActiveTourniquets();
        const bb = forensicBlackBox.getEvents();
        const sosCount = meshSosBeacon.getActiveDistressCount();

        return {
            timestamp: Date.now(),
            defconLevel: shield.currentDefcon,
            primaryBearer: swarm.primaryBearer,
            isElectronicWarfareActive: swarm.isElectronicWarfareActive,
            activeSosCount: sosCount,
            blackBoxEventsLogged: bb.length,

            droneThreatLevel: sigint.threatLevel,
            radiationRateUsVh: rad.doseRateUsVh,
            radiationThreatLevel: rad.threatLevel,

            activeTourniquetsCount: tqs.length,
            hasIschemicAlert: tqs.some(t => t.isIschemicAlert),
        };
    }

    /**
     * Genera el informe ejecutivo militar C4ISR consolidado
     */
    public generateExecutiveReport(): string {
        const s = this.getSnapshot();
        return `══════════════════════════════════════════════════════
     RED C4ISR THEATER OF OPERATIONS EXECUTIVE REPORT
══════════════════════════════════════════════════════
FECHA/HORA : ${new Date(s.timestamp).toISOString()}

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
}

export const c4isrMatrix = C4isrTacticalMatrixEngine.getInstance();

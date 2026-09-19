/**
 * ConnectomeCortexBridge.ts — RED Sovereign Mesh OS
 *
 * Puente Neuro-Simbólico y Semántico del Conectoma de Drosophila melanogaster
 * (MaleCNS v1.0, Princeton Murthy Lab / FlyWire Connectome).
 *
 * Propósito Arquitectónico:
 * Unifica la telemetría biofísica en tiempo real de los cuatro núcleos neuronales:
 * 1. Complejo Central (RingAttractorEngine): Brújula inercial de 16 cuñas E-PG y anclaje sensorial.
 * 2. Enrutador Sináptico (SynapticMeshRouterEngine): Plasticidad hebbiana, Rich-Club hubs, podas y radiogoniometría AoA.
 * 3. Cuerpo Fungiforme (DtnMushroomBodyEngine): Memoria asociativa de 2,500 Kenyon Cells, valencia DAN, LTP/LTD y engramas de ruta.
 * 4. Sistema de Fibras Gigantes (GiantFiberReflexEngine): Reflejo monosináptico de escape, EMCON y contramedidas EW.
 *
 * Integra esta información de manera viva, sin simulaciones ni datos ficticios,
 * alimentando el contexto táctico del Copiloto IA y la inferencia local.
 */

import { synapticMeshRouter, RfPeerBearing } from '../neuro/SynapticMeshRouterEngine';
import { ringAttractor, RingAttractorTelemetry } from '../neuro/RingAttractorEngine';
import { dtnMushroomBody, MushroomBodyTelemetry } from '../neuro/DtnMushroomBodyEngine';
import { giantFiberReflex, GiantFiberTelemetry } from '../neuro/GiantFiberReflexEngine';

export interface ConnectomeSnapshot {
  timestamp: number;
  compass: {
    headingDeg: number;
    cardinal: string;
    confidence: number;
    isSensoryAnchored: boolean;
    angularVelocityDps: number;
    driftEstimateDpm: number;
    rfBearingsCount: number;
  };
  synapticRouter: {
    totalSynapses: number;
    meanWeight: number;
    richClubHubsCount: number;
    prunedCount: number;
    lifMembranePotentialMv: number;
    lifQueueLength: number;
    activeBearings: RfPeerBearing[];
  };
  mushroomBody: {
    enqueuedRecords: number;
    ltpPinnedRecords: number;
    ltdEvictedTotal: number;
    meanValence: number;
    saturationRatio: number;
  };
  giantFiber: {
    state: string;
    isRadioSilenced: boolean;
    reflexTriggerCount: number;
    lastEscapeLatencyMs: number;
    activeThreatsCount: number;
  };
  tacticalEvaluation: {
    meshHealth: 'OPTIMAL' | 'DEGRADED' | 'EMCON_REFLEX' | 'CRITICAL';
    aoaBearingsActive: number;
    topPeerBearing: RfPeerBearing | null;
    summary: string;
  };
}

export class ConnectomeCortexBridge {
  private static instance: ConnectomeCortexBridge | null = null;

  private constructor() {}

  public static getInstance(): ConnectomeCortexBridge {
    if (!ConnectomeCortexBridge.instance) {
      ConnectomeCortexBridge.instance = new ConnectomeCortexBridge();
    }
    return ConnectomeCortexBridge.instance;
  }

  /**
   * Captura una instantánea completa y empírica del estado del conectoma.
   */
  public getConnectomeSnapshot(): ConnectomeSnapshot {
    const cxTelem = ringAttractor.getTelemetry();
    const synTelem = synapticMeshRouter.getTelemetry();
    const mbTelem = dtnMushroomBody.getTelemetry();
    const gfsTelem = giantFiberReflex.getTelemetry();
    const activeBearings = synapticMeshRouter.getAllActiveBearings();

    const topBearing = activeBearings.length > 0 ? activeBearings[0] : null;

    let meshHealth: ConnectomeSnapshot['tacticalEvaluation']['meshHealth'] = 'OPTIMAL';
    if (gfsTelem.emconLockActive) {
      meshHealth = 'EMCON_REFLEX';
    } else if (synTelem.meanWeight < 0.25 || synTelem.prunedLinksCount > synTelem.totalSynapses * 0.5) {
      meshHealth = 'DEGRADED';
    } else if (synTelem.totalSynapses === 0 && mbTelem.currentSaturationRatio > 0.8) {
      meshHealth = 'CRITICAL';
    }

    const summary = `Conectoma Drosophila MaleCNS activo. Brújula E-PG a ${cxTelem.headingDeg}° (${cxTelem.cardinal}, Conf: ${(cxTelem.confidence * 100).toFixed(0)}%). ` +
      `Enrutador sináptico con ${synTelem.totalSynapses} sinapsis, ${synTelem.richClubHubs.length} hubs troncales y ${activeBearings.length} marcaciones AoA RF activas. ` +
      `Cuerpo fungiforme con ${mbTelem.totalEnqueuedRecords} engramas (${mbTelem.ltpPinnedRecords} inmunes LTP). ` +
      `Fibras gigantes: ${gfsTelem.emconLockActive ? 'EMCON SILENCIO RADIO' : 'RADAR ACTIVO'}.`;

    return {
      timestamp: Date.now(),
      compass: {
        headingDeg: cxTelem.headingDeg,
        cardinal: cxTelem.cardinal,
        confidence: cxTelem.confidence,
        isSensoryAnchored: cxTelem.isSensoryAnchored,
        angularVelocityDps: cxTelem.angularVelocityDps,
        driftEstimateDpm: cxTelem.driftEstimateDpm,
        rfBearingsCount: cxTelem.rfBearings?.length || 0,
      },
      synapticRouter: {
        totalSynapses: synTelem.totalSynapses,
        meanWeight: synTelem.meanWeight,
        richClubHubsCount: synTelem.richClubHubs.length,
        prunedCount: synTelem.prunedLinksCount,
        lifMembranePotentialMv: synTelem.lifMembranePotentialMv,
        lifQueueLength: synTelem.lifAccumulatedCount,
        activeBearings,
      },
      mushroomBody: {
        enqueuedRecords: mbTelem.totalEnqueuedRecords,
        ltpPinnedRecords: mbTelem.ltpPinnedRecords,
        ltdEvictedTotal: mbTelem.ltdEvictedTotal,
        meanValence: mbTelem.meanValence,
        saturationRatio: mbTelem.currentSaturationRatio,
      },
      giantFiber: {
        state: gfsTelem.emconLockActive ? 'EMCON_LOCKED' : (gfsTelem.isReflexActive ? 'REFLEX_ACTIVE' : 'STANDBY'),
        isRadioSilenced: gfsTelem.emconLockActive,
        reflexTriggerCount: gfsTelem.totalEscapesExecuted,
        lastEscapeLatencyMs: gfsTelem.lastReflexLatencyMs,
        activeThreatsCount: gfsTelem.isReflexActive ? 1 : 0,
      },
      tacticalEvaluation: {
        meshHealth,
        aoaBearingsActive: activeBearings.length,
        topPeerBearing: topBearing,
        summary,
      },
    };
  }

  /**
   * Genera el bloque de contexto conectómico formateado para inyección en el Copiloto IA.
   */
  public getFormattedContextForCopilot(): string {
    const s = this.getConnectomeSnapshot();
    const bearingLines = s.synapticRouter.activeBearings.slice(0, 3).map(b => 
      `  • Par ${b.peerId.slice(0, 8)}...: Rumbo RF ${b.bearingDeg}° (Confianza ${(b.confidence * 100).toFixed(0)}%, LQS: ${b.lqs}%, Muestras: ${b.samplesCount})`
    );

    const bearingSection = bearingLines.length > 0
      ? `\nRadiogoniometría Bio-Inercial AoA:\n${bearingLines.join('\n')}`
      : '\nRadiogoniometría AoA: Sin marcaciones direccionales suficientes (rotar dispositivo para calibrar).';

    return `[Conectoma Bio-Inspirado Drosophila MaleCNS]:\n` +
      `• Rumbo Brújula E-PG: ${s.compass.headingDeg}° (${s.compass.cardinal}, Conf: ${(s.compass.confidence * 100).toFixed(0)}%, Anclaje: ${s.compass.isSensoryAnchored ? 'OK' : 'INERCIAL PURA'})\n` +
      `• Red Sináptica: ${s.synapticRouter.totalSynapses} enlaces | Peso medio: ${s.synapticRouter.meanWeight.toFixed(2)} | Hubs Rich-Club: ${s.synapticRouter.richClubHubsCount} | Podados: ${s.synapticRouter.prunedCount}\n` +
      `• Potencial LIF: ${s.synapticRouter.lifMembranePotentialMv} mV | Cola sub-umbral: ${s.synapticRouter.lifQueueLength} paquetes\n` +
      `• Memoria Fungiforme DTN: ${s.mushroomBody.enqueuedRecords} engramas | LTP Inmunes: ${s.mushroomBody.ltpPinnedRecords} | Desalojos LTD: ${s.mushroomBody.ltdEvictedTotal}\n` +
      `• Fibras Gigantes (GF): Estado ${s.giantFiber.state} | Silencio EMCON: ${s.giantFiber.isRadioSilenced ? 'ACTIVO' : 'NO'}${bearingSection}`;
  }

  /**
   * Responde de forma interactiva y detallada a preguntas sobre el estado conectómico.
   */
  public evaluateConnectomeTacticalQuery(query: string): string {
    const s = this.getConnectomeSnapshot();
    const cleanQ = (query || '').toLowerCase();

    // Consulta específica sobre radiogoniometría / Angle of Arrival
    if (/bearing|radiogoniometr|aoa|direcci[oó]n.*rf|l[oó]bulo/i.test(cleanQ)) {
      if (s.synapticRouter.activeBearings.length === 0) {
        return `🧭 **Radiogoniometría Bio-Inercial AoA (Direction-Finding)**\n\n` +
          `• **Estado:** No se han acumulado suficientes muestras angulares en los 16 sectores para una solución confiable.\n` +
          `• **Rumbo Actual del Dispositivo (E-PG):** ${s.compass.headingDeg}° (${s.compass.cardinal})\n` +
          `• **Procedimiento de Calibración:**\n` +
          `  1. Mantén la app abierta mientras recibes transmisiones de los pares o difusiones de la malla.\n` +
          `  2. Rota lentamente el dispositivo en 360° en el plano horizontal para que la antena interna registre la modulación de señal (LQS / RSSI) en distintos azimuts.\n` +
          `  3. La red calculará automáticamente el vector de población circular de Rayleigh para estimar la dirección de origen del transmisor.`;
      }

      const list = s.synapticRouter.activeBearings.map((b, idx) => {
        return `**${idx + 1}. Nodo ${b.peerId.slice(0, 12)}...**\n` +
          `• **Marcación Estimada (Azimut):** ${b.bearingDeg}° (Respecto al Norte magnético/inercial)\n` +
          `• **Confianza Vectorial:** ${(b.confidence * 100).toFixed(1)}% (Concentración de Rayleigh)\n` +
          `• **Calidad de Señal LQS:** ${b.lqs}/100\n` +
          `• **Muestras Angulares Acumuladas:** ${b.samplesCount} paquetes en 16 sectores\n` +
          `• **Último Contacto:** hace ${Math.round((Date.now() - b.lastSeenTs) / 1000)}s`;
      }).join('\n\n');

      return `🎯 **Solución de Radiogoniometría Bio-Inercial AoA**\n\n` +
        `Decodificación de Angle of Arrival mediante vector poblacional de 16 sectores circulares:\n\n${list}\n\n` +
        `*Puedes consultar la Brújula Táctica o el HUD del Conectoma para visualizar el cono de marcación en vivo.*`;
    }

    // Consulta general sobre el conectoma de Drosophila
    return `🧠 **Telemetría Conectómica Unificada (Drosophila MaleCNS v1.0)**\n\n` +
      `**1. Complejo Central (Central Complex / CX):**\n` +
      `• Rumbo Bio-Inercial E-PG: **${s.compass.headingDeg}° (${s.compass.cardinal})**\n` +
      `• Confianza del Atractor: ${(s.compass.confidence * 100).toFixed(0)}%\n` +
      `• Modo de Anclaje: ${s.compass.isSensoryAnchored ? 'Anclado a Sensores Nativo' : '🛡️ Memoria de Trabajo Inercial Pura (Anti-Spoofing)'}\n` +
      `• Velocidad Angular: ${s.compass.angularVelocityDps}°/s (Deriva est: ${s.compass.driftEstimateDpm}°/min)\n\n` +
      `**2. Enrutador Sináptico Hebbiano (Mesh Topology):**\n` +
      `• Conexiones Sinápticas: ${s.synapticRouter.totalSynapses} pares\n` +
      `• Conductancia Media: ${s.synapticRouter.meanWeight.toFixed(3)}\n` +
      `• Hubs de Club Rico (Repetidores Troncales): ${s.synapticRouter.richClubHubsCount}\n` +
      `• Enlaces Podados (Supresión de Tormentas): ${s.synapticRouter.prunedCount}\n` +
      `• Acumulador Neuronal LIF: ${s.synapticRouter.lifMembranePotentialMv} mV (Cola: ${s.synapticRouter.lifQueueLength} paquetes)\n` +
      `• Nodos con Marcación AoA Activa: ${s.synapticRouter.activeBearings.length}\n\n` +
      `**3. Cuerpo Fungiforme (Mushroom Body / MB - DTN):**\n` +
      `• Engramas Asociativos en Memoria: ${s.mushroomBody.enqueuedRecords}\n` +
      `• Paquetes Inmunes LTP (SOS / CBRN / Blockchain): ${s.mushroomBody.ltpPinnedRecords}\n` +
      `• Desalojos por Depresión Sináptica LTD: ${s.mushroomBody.ltdEvictedTotal}\n` +
      `• Saturación de Memoria: ${(s.mushroomBody.saturationRatio * 100).toFixed(1)}%\n\n` +
      `**4. Sistema de Fibras Gigantes (Giant Fiber Reflex - EW):**\n` +
      `• Estado Operativo: ${s.giantFiber.state}\n` +
      `• Silencio de Radio (EMCON): ${s.giantFiber.isRadioSilenced ? '🔴 ACTIVO' : '🟢 RECEPTOR HABILITADO'}\n` +
      `• Latencia de Escape Monosináptico: ${s.giantFiber.lastEscapeLatencyMs > 0 ? `${s.giantFiber.lastEscapeLatencyMs} ms` : '< 15 ms nominal'}`;
  }
}

export const connectomeCortexBridge = ConnectomeCortexBridge.getInstance();

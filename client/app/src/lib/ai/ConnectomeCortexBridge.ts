/**
 * ConnectomeCortexBridge.ts — RED Sovereign Mesh OS
 *
 * Puente Neuro-Simbólico y Semántico del Conectoma de Drosophila melanogaster
 * (MaleCNS v1.0, Princeton Murthy Lab / FlyWire Connectome).
 *
 * Propósito Arquitectónico:
 * Unifica la telemetría biofísica en tiempo real de los siete núcleos neuronales:
 * 1. Complejo Central (RingAttractorEngine): Brújula inercial de 16 cuñas E-PG y anclaje sensorial.
 * 2. Cuerpo en Abanico (FanShapedBodyEngine): Integración de ruta 3D, Home Vector y Goal Vector.
 * 3. Enrutador Sináptico (SynapticMeshRouterEngine): Plasticidad hebbiana, Rich-Club hubs, podas y radiogoniometría AoA.
 * 4. Cuerpo Fungiforme (DtnMushroomBodyEngine): Memoria asociativa de 2,500 Kenyon Cells, valencia DAN PAM/PPL1 y feromonas.
 * 5. Sistema de Fibras Gigantes (GiantFiberReflexEngine): Reflejo monosináptico de escape, EMCON y contramedidas EW.
 * 6. Órgano de Johnston (JohnstonOrganEngine): Detección mecanosensorial y choque acústico.
 * 7. Gobernador Metabólico (MetabolicNeuromorphicGovernor): Triaje energético IPC/NPF y modulación de reloj.
 */

import { synapticMeshRouter, RfPeerBearing } from '../neuro/SynapticMeshRouterEngine';
import { ringAttractor } from '../neuro/RingAttractorEngine';
import { fanShapedBody } from '../neuro/FanShapedBodyEngine';
import { dtnMushroomBody } from '../neuro/DtnMushroomBodyEngine';
import { giantFiberReflex } from '../neuro/GiantFiberReflexEngine';
import { johnstonOrgan } from '../neuro/JohnstonOrganEngine';
import { metabolicGovernor } from '../neuro/MetabolicNeuromorphicGovernor';

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
  fanShapedBody: {
    homeDistanceMeters: number;
    homeBearingDeg: number;
    homeCardinal: string;
    totalDistanceTraveledMeters: number;
    position: { x: number; y: number; z: number };
    hasTarget: boolean;
    targetDistanceMeters: number;
    targetBearingDeg: number;
    steeringErrorDeg: number;
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
    behavioralDrive: string;
    behavioralValenceScore: number;
    activePheromonesCount: number;
  };
  giantFiber: {
    state: string;
    isRadioSilenced: boolean;
    reflexTriggerCount: number;
    lastEscapeLatencyMs: number;
    activeThreatsCount: number;
  };
  johnstonOrgan: {
    acousticEnergyLevel: number;
    windDeflectionAngleDeg: number;
    vibrationFrequencyHz: number;
    shockEventsCount: number;
  };
  metabolicGovernor: {
    regime: string;
    ipcLevel: number;
    npfLevel: number;
    batteryPct: number;
    neuralClockIntervalMs: number;
    estimatedStandbyHours: number;
  };
  tacticalEvaluation: {
    meshHealth: 'OPTIMAL' | 'DEGRADED' | 'EMCON_REFLEX' | 'CRITICAL' | 'TORPOR';
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
   * Captura una instantánea completa y empírica del estado del conectoma unificado.
   */
  public getConnectomeSnapshot(): ConnectomeSnapshot {
    const cxTelem = ringAttractor.getTelemetry();
    const fbTelem = fanShapedBody.getTelemetry();
    const synTelem = synapticMeshRouter.getTelemetry();
    const mbTelem = dtnMushroomBody.getTelemetry();
    const gfsTelem = giantFiberReflex.getTelemetry();
    const joTelem = johnstonOrgan.getTelemetry();
    const metTelem = metabolicGovernor.getTelemetry();
    const activeBearings = synapticMeshRouter.getAllActiveBearings();

    const topBearing = activeBearings.length > 0 ? activeBearings[0] : null;

    let meshHealth: ConnectomeSnapshot['tacticalEvaluation']['meshHealth'] = 'OPTIMAL';
    if (gfsTelem.emconLockActive) {
      meshHealth = 'EMCON_REFLEX';
    } else if (metTelem.regime === 'TORPOR') {
      meshHealth = 'TORPOR';
    } else if (synTelem.meanWeight < 0.25 || synTelem.prunedLinksCount > synTelem.totalSynapses * 0.5) {
      meshHealth = 'DEGRADED';
    } else if (synTelem.totalSynapses === 0 && mbTelem.currentSaturationRatio > 0.8) {
      meshHealth = 'CRITICAL';
    }

    const summary = `Conectoma Drosophila MaleCNS activo [Régimen: ${metTelem.regime}]. Brújula E-PG a ${cxTelem.headingDeg}° (${cxTelem.cardinal}). ` +
      `Home Vector FB a ${fbTelem.homeVector.distanceMeters}m rumbo ${fbTelem.homeVector.bearingDeg}° (${fbTelem.homeVector.cardinal}). ` +
      `Red sináptica con ${synTelem.totalSynapses} pares (${synTelem.richClubHubs.length} hubs), DTN: ${mbTelem.totalEnqueuedRecords} engramas (${mbTelem.behavioralDrive}). ` +
      `Sensor acústico JO: ${(joTelem.acousticEnergyLevel * 100).toFixed(0)}% energía. Fibras gigantes: ${gfsTelem.emconLockActive ? 'EMCON SILENCIO RADIO' : 'RADAR ACTIVO'}.`;

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
      fanShapedBody: {
        homeDistanceMeters: fbTelem.homeVector.distanceMeters,
        homeBearingDeg: fbTelem.homeVector.bearingDeg,
        homeCardinal: fbTelem.homeVector.cardinal,
        totalDistanceTraveledMeters: fbTelem.totalDistanceTraveledMeters,
        position: {
          x: fbTelem.currentPosition.xMeters,
          y: fbTelem.currentPosition.yMeters,
          z: fbTelem.currentPosition.zMeters,
        },
        hasTarget: fbTelem.goalVector.hasTarget,
        targetDistanceMeters: fbTelem.goalVector.distanceMeters,
        targetBearingDeg: fbTelem.goalVector.bearingDeg,
        steeringErrorDeg: fbTelem.goalVector.steeringErrorDeg,
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
        behavioralDrive: mbTelem.behavioralDrive,
        behavioralValenceScore: mbTelem.behavioralValenceScore,
        activePheromonesCount: mbTelem.activePheromonesCount,
      },
      giantFiber: {
        state: gfsTelem.emconLockActive ? 'EMCON_LOCKED' : (gfsTelem.isReflexActive ? 'REFLEX_ACTIVE' : 'STANDBY'),
        isRadioSilenced: gfsTelem.emconLockActive,
        reflexTriggerCount: gfsTelem.totalEscapesExecuted,
        lastEscapeLatencyMs: gfsTelem.lastReflexLatencyMs,
        activeThreatsCount: gfsTelem.isReflexActive ? 1 : 0,
      },
      johnstonOrgan: {
        acousticEnergyLevel: joTelem.acousticEnergyLevel,
        windDeflectionAngleDeg: joTelem.windDeflectionAngleDeg,
        vibrationFrequencyHz: joTelem.vibrationFrequencyHz,
        shockEventsCount: joTelem.shockEventsCount,
      },
      metabolicGovernor: {
        regime: metTelem.regime,
        ipcLevel: metTelem.ipcLevel,
        npfLevel: metTelem.npfLevel,
        batteryPct: metTelem.batteryPct,
        neuralClockIntervalMs: metTelem.neuralClockIntervalMs,
        estimatedStandbyHours: metTelem.estimatedStandbyHours,
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
      : '\nRadiogoniometría AoA: Sin marcaciones direccionales suficientes.';

    return `[Conectoma Bio-Cibernético Drosophila MaleCNS v1.0]:\n` +
      `• Rumbo E-PG: ${s.compass.headingDeg}° (${s.compass.cardinal}, Conf: ${(s.compass.confidence * 100).toFixed(0)}%, Anclaje: ${s.compass.isSensoryAnchored ? 'OK' : 'INERCIAL'})\n` +
      `• Navegación FB (Home Vector): ${s.fanShapedBody.homeDistanceMeters}m hacia ${s.fanShapedBody.homeBearingDeg}° (${s.fanShapedBody.homeCardinal}) | Recorrido: ${s.fanShapedBody.totalDistanceTraveledMeters}m\n` +
      `• Red Sináptica: ${s.synapticRouter.totalSynapses} pares | Conductancia: ${s.synapticRouter.meanWeight.toFixed(2)} | Rich-Club: ${s.synapticRouter.richClubHubsCount}\n` +
      `• Memoria MB: ${s.mushroomBody.enqueuedRecords} engramas | Conducta: ${s.mushroomBody.behavioralDrive} (${s.mushroomBody.behavioralValenceScore > 0 ? '+' : ''}${s.mushroomBody.behavioralValenceScore}) | Feromonas: ${s.mushroomBody.activePheromonesCount}\n` +
      `• Fibras Gigantes: ${s.giantFiber.state} (EMCON: ${s.giantFiber.isRadioSilenced ? 'ACTIVO' : 'NO'})\n` +
      `• Sensor JO: ${(s.johnstonOrgan.acousticEnergyLevel * 100).toFixed(0)}% energía acústica (${s.johnstonOrgan.vibrationFrequencyHz} Hz)\n` +
      `• Metabolismo IPC/NPF: Régimen ${s.metabolicGovernor.regime} (Batería: ${s.metabolicGovernor.batteryPct}%, Autonomía est: ${s.metabolicGovernor.estimatedStandbyHours}h)${bearingSection}`;
  }

  /**
   * Responde de forma interactiva y detallada a preguntas sobre el estado conectómico.
   */
  public evaluateConnectomeTacticalQuery(query: string): string {
    const s = this.getConnectomeSnapshot();
    const cleanQ = (query || '').toLowerCase();

    // Consulta específica sobre navegación vectorial 3D / Retorno a Casa
    if (/home.*vector|retorno|volver|nido|casa|odometr|fan.*shaped|rumbo.*casa/i.test(cleanQ)) {
      return `🧭 **Navegación Vectorial 3D Fan-Shaped Body (Retorno a Casa)**\n\n` +
        `• **Distancia al Punto de Partida:** ${s.fanShapedBody.homeDistanceMeters} metros\n` +
        `• **Rumbo Azimutal de Retorno:** ${s.fanShapedBody.homeBearingDeg}° (${s.fanShapedBody.homeCardinal})\n` +
        `• **Distancia Total Recorrida:** ${s.fanShapedBody.totalDistanceTraveledMeters} metros\n` +
        `• **Posición Relativa:** X=${s.fanShapedBody.position.x}m (Este), Y=${s.fanShapedBody.position.y}m (Norte), Z=${s.fanShapedBody.position.z}m (Altitud)\n` +
        (s.fanShapedBody.hasTarget ? `• **Objetivo Activo:** ${s.fanShapedBody.targetDistanceMeters}m hacia ${s.fanShapedBody.targetBearingDeg}° (Error de timoneo: ${s.fanShapedBody.steeringErrorDeg}°)\n` : '') +
        `• **Integración:** Matriz de 16 columnas x 9 capas P-FN y Δ7 activas en tiempo real.`;
    }

    // Consulta sobre Metabolismo, Batería o Torpor
    if (/metabol|torpor|bater|ipc|npf|consumo.*energ|reloj.*sin[aá]ptico/i.test(cleanQ)) {
      return `⚡ **Gobernador Metabólico Neuroendocrino (IPC / NPF)**\n\n` +
        `• **Régimen Operacional:** **${s.metabolicGovernor.regime}**\n` +
        `• **Nivel de Batería:** ${s.metabolicGovernor.batteryPct}%\n` +
        `• **Autonomía Estimada en Malla:** ~${s.metabolicGovernor.estimatedStandbyHours} horas\n` +
        `• **Índice de Saciedad (IPC):** ${(s.metabolicGovernor.ipcLevel * 100).toFixed(0)}%\n` +
        `• **Índice de Austeridad (NPF):** ${(s.metabolicGovernor.npfLevel * 100).toFixed(0)}%\n` +
        `• **Intervalo del Reloj Sináptico:** ${s.metabolicGovernor.neuralClockIntervalMs} ms (${1000 / s.metabolicGovernor.neuralClockIntervalMs} Hz)\n` +
        `• **Impacto Operativo:** ${s.metabolicGovernor.regime === 'TORPOR' ? 'Máxima conservación activa. Tráfico LoRa limitado a balizas SOS.' : 'Operación fluida con refresco nominal.'}`;
    }

    // Consulta específica sobre radiogoniometría / Angle of Arrival
    if (/bearing|radiogoniometr|aoa|direcci[oó]n.*rf|l[oó]bulo/i.test(cleanQ)) {
      if (s.synapticRouter.activeBearings.length === 0) {
        return `🧭 **Radiogoniometría Bio-Inercial AoA (Direction-Finding)**\n\n` +
          `• **Estado:** No se han acumulado suficientes muestras angulares en los 16 sectores para una solución confiable.\n` +
          `• **Rumbo Actual del Dispositivo (E-PG):** ${s.compass.headingDeg}° (${s.compass.cardinal})\n` +
          `• **Procedimiento de Calibración:** Rota lentamente el dispositivo en 360° en el plano horizontal para muestrear la señal LoRa/BLE en todos los sectores.`;
      }

      const list = s.synapticRouter.activeBearings.map((b, idx) => {
        return `**${idx + 1}. Nodo ${b.peerId.slice(0, 12)}...**\n` +
          `• **Marcación Estimada (Azimut):** ${b.bearingDeg}° (Respecto al Norte magnético/inercial)\n` +
          `• **Confianza Vectorial:** ${(b.confidence * 100).toFixed(1)}%\n` +
          `• **Calidad de Señal LQS:** ${b.lqs}/100\n` +
          `• **Muestras Angulares:** ${b.samplesCount} paquetes en 16 sectores`;
      }).join('\n\n');

      return `🎯 **Solución de Radiogoniometría Bio-Inercial AoA**\n\n${list}`;
    }

    // Consulta general sobre el conectoma de Drosophila
    return `🧠 **Telemetría Conectómica Unificada (Drosophila MaleCNS v1.0)**\n\n` +
      `**1. Complejo Central (Central Complex / CX):**\n` +
      `• Rumbo E-PG: **${s.compass.headingDeg}° (${s.compass.cardinal})** (Confianza: ${(s.compass.confidence * 100).toFixed(0)}%)\n` +
      `• Home Vector FB: **${s.fanShapedBody.homeDistanceMeters} m** hacia **${s.fanShapedBody.homeBearingDeg}°** (${s.fanShapedBody.homeCardinal})\n\n` +
      `**2. Enrutador Sináptico Hebbiano & AoA:**\n` +
      `• Sinapsis Activas: ${s.synapticRouter.totalSynapses} pares | Hubs Troncales: ${s.synapticRouter.richClubHubsCount}\n` +
      `• Nodos con Marcación AoA Activa: ${s.synapticRouter.activeBearings.length}\n\n` +
      `**3. Memoria Fungiforme DTN & Conducta:**\n` +
      `• Engramas Asociativos: ${s.mushroomBody.enqueuedRecords} (Inmunes LTP: ${s.mushroomBody.ltpPinnedRecords})\n` +
      `• Propensión Conductual: **${s.mushroomBody.behavioralDrive}** (Balance: ${s.mushroomBody.behavioralValenceScore})\n` +
      `• Feromonas de Enjambre Activas: ${s.mushroomBody.activePheromonesCount}\n\n` +
      `**4. Sistema de Fibras Gigantes (EW / Escape):**\n` +
      `• Estado: ${s.giantFiber.state} | Silencio EMCON: ${s.giantFiber.isRadioSilenced ? '🔴 ACTIVO' : '🟢 RECEPTOR HABILITADO'}\n\n` +
      `**5. Órgano de Johnston & Metabolismo:**\n` +
      `• Nivel Acústico JO: ${(s.johnstonOrgan.acousticEnergyLevel * 100).toFixed(0)}% (${s.johnstonOrgan.vibrationFrequencyHz} Hz) | Choques: ${s.johnstonOrgan.shockEventsCount}\n` +
      `• Régimen Metabólico: **${s.metabolicGovernor.regime}** (Batería: ${s.metabolicGovernor.batteryPct}%, Est. Standby: ${s.metabolicGovernor.estimatedStandbyHours}h)`;
  }
}

export const connectomeCortexBridge = ConnectomeCortexBridge.getInstance();

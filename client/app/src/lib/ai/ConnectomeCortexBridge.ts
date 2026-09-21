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
import { opticLobe } from '../neuro/OpticLobeEngine';
import { tacticalMotorActuator } from '../neuro/TacticalMotorActuatorEngine';
import { humanBrainOrchestrator } from '../neuro/human/HumanBrainOrchestrator';
import { globalWorkspaceConsciousnessBus, ConsciousnessSnapshot } from '../neuro/GlobalWorkspaceConsciousnessBus';

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
  opticLobe: {
    translationalVelocity: number;
    rotationalVelocityDps: number;
    loomingDetected: boolean;
    loomingExpansionRate: number;
    activeOmmatidiaCount: number;
  };
  motorActuator: {
    currentMode: string;
    steeringErrorDeg: number;
    dna01Excitation: number;
    dna02Excitation: number;
    totalPulsesDispatched: number;
  };
  tacticalEvaluation: {
    meshHealth: 'OPTIMAL' | 'DEGRADED' | 'EMCON_REFLEX' | 'CRITICAL' | 'TORPOR';
    aoaBearingsActive: number;
    topPeerBearing: RfPeerBearing | null;
    summary: string;
  };
  consciousnessBus?: ConsciousnessSnapshot;
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
    const opticTelem = opticLobe.getTelemetry();
    const motorTelem = tacticalMotorActuator.getTelemetry();
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
      `Visión T4/T5: ${opticTelem.translationalFlow.magnitude} m/s, Looming: ${opticTelem.loomingThreat.isThreatDetected ? 'AMENAZA' : 'OK'}. ` +
      `Actuador DNa: ${motorTelem.currentHapticMode}. Fibras gigantes: ${gfsTelem.emconLockActive ? 'EMCON SILENCIO RADIO' : 'RADAR ACTIVO'}.`;

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
      opticLobe: {
        translationalVelocity: opticTelem.translationalFlow.magnitude,
        rotationalVelocityDps: opticTelem.visualAngularVelocityDegPerSec,
        loomingDetected: opticTelem.loomingThreat.isThreatDetected,
        loomingExpansionRate: opticTelem.loomingThreat.expansionRate,
        activeOmmatidiaCount: 256,
      },
      motorActuator: {
        currentMode: motorTelem.currentHapticMode,
        steeringErrorDeg: motorTelem.steeringErrorDeg,
        dna01Excitation: motorTelem.dna01IpsilateralExcitation,
        dna02Excitation: motorTelem.dna02ContralateralExcitation,
        totalPulsesDispatched: motorTelem.totalPulsesDispatched,
      },
      tacticalEvaluation: {
        meshHealth,
        aoaBearingsActive: activeBearings.length,
        topPeerBearing: topBearing,
        summary,
      },
      consciousnessBus: globalWorkspaceConsciousnessBus.getSnapshot(),
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

    const humanSnapshot = humanBrainOrchestrator.getSnapshot();
    const humanSection = `\n\n[Neocorteza Bio-Cibernética Humana (7 Núcleos Cognitivos)]:\n` +
      `• Alerta General: ${humanSnapshot.alertLevel} (${humanSnapshot.synthesisSummary})\n` +
      `• Odometría Entorrinal MEC: [X=${humanSnapshot.entorhinal.currentCoordsLocal.xMeters.toFixed(1)}, Y=${humanSnapshot.entorhinal.currentCoordsLocal.yMeters.toFixed(1)}, Z=${humanSnapshot.entorhinal.currentCoordsLocal.zMeters.toFixed(1)}]m | Actividad: ${(humanSnapshot.entorhinal.compositeGridActivity * 100).toFixed(0)}%\n` +
      `• Hipocampo CA3/DG: ${humanSnapshot.hippocampal.patternCompletionsCount} tramas mutiladas recuperadas por pattern completion\n` +
      `• Inferencia Activa (Zero-Bandwidth): ${humanSnapshot.predictive.isZeroBandwidthModeActive ? 'ACTIVO' : 'NO'} | Ahorro RF: ${humanSnapshot.predictive.overallBandwidthReductionPct.toFixed(0)}% | Sorpresa: ${humanSnapshot.predictive.currentFreeEnergy.toFixed(2)}\n` +
      `• Teoría de la Mente ToM: Confianza ${Math.round(humanSnapshot.theoryOfMind.meanNetworkTrustScore * 100)}% | Alertas Emboscada: ${humanSnapshot.theoryOfMind.activeAmbushAlertsCount}\n` +
      `• Memoria Ejecutiva DLPFC: Objetivo "${humanSnapshot.workingMemory.activeTask?.title || 'Completado'}" | Progreso: ${humanSnapshot.workingMemory.overallProgressPct}%\n` +
      `• Ínsula Anterior TCCC: Vagal ${humanSnapshot.insular.isBoxBreathingActive ? humanSnapshot.insular.boxBreathingPhase : 'STANDBY'} | Bajas: ${humanSnapshot.insular.activeCasualtiesCount} | Torniquetes: ${humanSnapshot.insular.activeTourniquetsCount}\n` +
      `• Economía OFC: Autarquía: ${humanSnapshot.orbitofrontal.autarkyDaysRemaining} días | Contratos Barter: ${humanSnapshot.orbitofrontal.activeContractsCount}`;

    const consciousnessSnapshot = globalWorkspaceConsciousnessBus.getSnapshot();
    const consciousnessSection = `\n\n[Espacio de Trabajo Global (GNWT & Conciencia de Enjambre)]:\n` +
      `• Ignición Atencional: ${consciousnessSnapshot.isIgnited ? '🔥 IGNITADO' : '🟢 LATENTE'} (Intensidad: ${(consciousnessSnapshot.ignitionIntensity * 100).toFixed(0)}%)\n` +
      `• Foco Consciente: ${consciousnessSnapshot.consciousFocus} (${consciousnessSnapshot.salienceWinner.rationale})\n` +
      `• Integración Φ (IIT): ${(consciousnessSnapshot.phiApprox * 10).toFixed(1)}/10 | Energía Libre F: ${consciousnessSnapshot.variationalFreeEnergy.toFixed(3)}\n` +
      `• Sincronización Kuramoto: ${(consciousnessSnapshot.kuramotoOrderR * 100).toFixed(1)}% coherencia de enjambre`;

    return `[Conectoma Bio-Cibernético Drosophila MaleCNS v1.0]:\n` +
      `• Rumbo E-PG: ${s.compass.headingDeg}° (${s.compass.cardinal}, Conf: ${(s.compass.confidence * 100).toFixed(0)}%, Anclaje: ${s.compass.isSensoryAnchored ? 'OK' : 'INERCIAL'})\n` +
      `• Navegación FB (Home Vector): ${s.fanShapedBody.homeDistanceMeters}m hacia ${s.fanShapedBody.homeBearingDeg}° (${s.fanShapedBody.homeCardinal}) | Recorrido: ${s.fanShapedBody.totalDistanceTraveledMeters}m\n` +
      `• Red Sináptica: ${s.synapticRouter.totalSynapses} pares | Conductancia: ${s.synapticRouter.meanWeight.toFixed(2)} | Rich-Club: ${s.synapticRouter.richClubHubsCount}\n` +
      `• Memoria MB: ${s.mushroomBody.enqueuedRecords} engramas | Conducta: ${s.mushroomBody.behavioralDrive} | Feromonas: ${s.mushroomBody.activePheromonesCount}\n` +
      `• Visión T4/T5 & LC4: Flujo ${s.opticLobe.translationalVelocity.toFixed(2)} m/s | Looming: ${s.opticLobe.loomingDetected ? '🚨 AMENAZA BALÍSTICA' : 'DESPEJADO'}\n` +
      `• Actuador Háptico DNa: Modo ${s.motorActuator.currentMode} (Error: ${s.motorActuator.steeringErrorDeg}°)\n` +
      `• Fibras Gigantes: ${s.giantFiber.state} (EMCON: ${s.giantFiber.isRadioSilenced ? 'ACTIVO' : 'NO'})\n` +
      `• Sensor JO: ${(s.johnstonOrgan.acousticEnergyLevel * 100).toFixed(0)}% energía acústica (${s.johnstonOrgan.vibrationFrequencyHz} Hz)\n` +
      `• Metabolismo IPC/NPF: Régimen ${s.metabolicGovernor.regime} (Batería: ${s.metabolicGovernor.batteryPct}%, Autonomía: ${s.metabolicGovernor.estimatedStandbyHours}h)${bearingSection}${humanSection}${consciousnessSection}`;
  }

  /**
   * Responde de forma interactiva y detallada a preguntas sobre el estado conectómico.
   */
  public evaluateConnectomeTacticalQuery(query: string): string {
    const s = this.getConnectomeSnapshot();
    const cleanQ = (query || '').toLowerCase();
    const hs = humanBrainOrchestrator.getSnapshot();

    // Consulta sobre Triage TCCC, Box Breathing o Trauma
    if (/triage|march|trauma|torniquete|isquemia|vagal|respiraci[oó]n|box breathing/i.test(cleanQ)) {
      return `🩸 **Ínsula Anterior & Protocolo TCCC MARCH**\n\n` +
        `• **Estado Vagal (Box Breathing 4-4-4-4):** ${hs.insular.isBoxBreathingActive ? `ACTIVO • Fase: ${hs.insular.boxBreathingPhase} (${hs.insular.phaseSecondsRemaining}s)` : 'Standby / Pausado'}\n` +
        `• **Bajas Registradas Bajo Fuego:** ${hs.insular.activeCasualtiesCount}\n` +
        `• **Torniquetes Aplicados:** ${hs.insular.activeTourniquetsCount}\n` +
        `• **Alerta de Isquemia:** ${hs.insular.criticalTourniquetWarning ? '🚨 ¡PELIGRO DE NECROSIS IRREVERSIBLE (>90 min)!' : '🟢 Sin riesgo de necrosis irreversible'}\n` +
        `• **Acceso:** Puedes abrir el panel TCCC desde el Mapa Táctico con el botón [TCCC].`;
    }

    // Consulta sobre Teoría de la Mente, Decepción o Emboscada
    if (/emboscada|decepci[oó]n|trampa|honey.*pot|teor[ií]a.*mente|tom|path loss/i.test(cleanQ)) {
      return `🛡️ **Teoría de la Mente (mPFC / TPJ - Detección de Emboscadas)**\n\n` +
        `• **Alerta de Emboscada Activa:** ${hs.theoryOfMind.activeAmbushAlertsCount > 0 ? `🚨 ¡ALERTA! ${hs.theoryOfMind.activeAmbushAlertsCount} anomalías críticas detectadas` : '🟢 Malla segura sin incongruencias físicas'}\n` +
        `• **Confianza Media de la Red:** ${Math.round(hs.theoryOfMind.meanNetworkTrustScore * 100)}%\n` +
        `• **Pares Auditados:** ${hs.theoryOfMind.totalPeersAudited} (Sospechosos: ${hs.theoryOfMind.suspiciousNodesCount})\n` +
        `• **Física Verificada:** Cruce de Log-Distance Path Loss (distancia vs RSSI medido) y coherencia de velocidad cinemática (< 45 m/s).`;
    }

    // Consulta sobre Cueva, Túnel o Células de Rejilla (Entorrinal)
    if (/cueva|t[uú]nel|subterr[aá]neo|entorrinal|grid.*cell|rejilla|miga/i.test(cleanQ)) {
      return `🗺️ **Corteza Entorrinal Medial (MEC - Navegación Hexagonal Subterránea)**\n\n` +
        `• **Offset Local 3D:** X=${hs.entorhinal.currentCoordsLocal.xMeters.toFixed(1)}m, Y=${hs.entorhinal.currentCoordsLocal.yMeters.toFixed(1)}m, Z=${hs.entorhinal.currentCoordsLocal.zMeters.toFixed(1)}m\n` +
        `• **Densidad de Rejilla:** ${(hs.entorhinal.compositeGridActivity * 100).toFixed(0)}% (Interferencia en 4 módulos: λ=0.5m, 2m, 8m, 32m)\n` +
        `• **Hitos Grabados (Breadcrumbs):** ${hs.entorhinal.breadcrumbsCount}\n` +
        `• **Alerta de Bordes:** ${hs.entorhinal.borderProximityWarning ? '⚠️ Obstáculo o pared detectada por células de borde' : '🟢 Espacio despejado'}\n` +
        `• **Función:** Permite desplazamiento y retorno a ciegas sin señal satelital GNSS.`;
    }

    // Consulta sobre Zero-Bandwidth o Inferencia Activa
    if (/zero.*bandwidth|silencio.*rf|inferencia.*activa|friston|energ[ií]a.*libre|sorpresa/i.test(cleanQ)) {
      return `⚡ **Corteza Predictiva Humana (Inferencia Activa de Friston)**\n\n` +
        `• **Modo Zero-Bandwidth:** ${hs.predictive.isZeroBandwidthModeActive ? '🟢 ACTIVO (Emisión de 0 Bytes mientras el movimiento sea predecible)' : '🔴 Desactivado'}\n` +
        `• **Reducción de Tráfico RF:** ${Math.round(hs.predictive.overallBandwidthReductionPct)}% de emisiones LoRa ahorradas\n` +
        `• **Nivel Actual de Energía Libre (Sorpresa):** ${hs.predictive.currentFreeEnergy.toFixed(3)}\n` +
        `• **Gemelos Cinemáticos:** ${hs.predictive.trackedPeersCount} nodos aliados en seguimiento predictivo descendente`;
    }

    // Consulta sobre Barter, Asedio o Autarquía Económica
    if (/barter|trueque|asedio|autarqu[ií]a|suministro|precio|econom[ií]a/i.test(cleanQ)) {
      return `⚖️ **Corteza Orbitofrontal (OFC - Valoración y Barter en Asedio)**\n\n` +
        `• **Autarquía Estimada del Destacamento:** **${hs.orbitofrontal.autarkyDaysRemaining} días** antes del agotamiento del recurso más escaso\n` +
        `• **Contratos de Trueque P2P:** ${hs.orbitofrontal.activeContractsCount} acuerdos evaluados\n` +
        `• **Criterio de Valoración:** Ley de Gossen y utilidad marginal subjetiva. El agua y medicamentos multiplican su valor según la reserva física real.`;
    }

    // Consulta sobre Visión, Lóbulos Ópticos o Detección Looming
    if (/optic|visi[oó]n|looming|amenaza.*visual|centinela|colisi[oó]n/i.test(cleanQ)) {
      return `👁️ **Lóbulos Ópticos Neuromórficos (T4/T5 & LC4 Looming)**\n\n` +
        `• **Detección Balística Looming:** ${s.opticLobe.loomingDetected ? '🚨 ¡AMENAZA EN APROXIMACIÓN RÁPIDA DETECTADA!' : '🟢 Espacio visual despejado'}\n` +
        `• **Tasa de Expansión Angular η(t):** ${s.opticLobe.loomingExpansionRate.toFixed(2)}/s (Umbral balístico: 1.20/s)\n` +
        `• **Odometría Visual (LPTC VS):** ${s.opticLobe.translationalVelocity.toFixed(2)} m/s\n` +
        `• **Rotación Angular Visual (LPTC HS):** ${s.opticLobe.rotationalVelocityDps.toFixed(1)} °/s\n` +
        `• **Receptores Omatidiales:** 256 sensores (malla 16x16) activos`;
    }

    // Consulta sobre Háptica o Guía Ojos-Libres (DNa01/DNa02)
    if (/h[aá]ptic|vibraci[oó]n|ojos.*libres|cieg|gui[aá].*h[aá]ptic|timoneo|dna/i.test(cleanQ)) {
      return `📳 **Actuador Somatosensorial Háptico (DNa01/DNa02)**\n\n` +
        `• **Modo Háptico Actual:** **${s.motorActuator.currentMode}**\n` +
        `• **Error de Timoneo:** ${s.motorActuator.steeringErrorDeg > 0 ? `+${s.motorActuator.steeringErrorDeg}° (Virar a Estribor / Derecha)` : `${s.motorActuator.steeringErrorDeg}° (Virar a Babor / Izquierda)`}\n` +
        `• **Excitación DNa01 (Babor):** ${s.motorActuator.dna01Excitation.toFixed(2)}\n` +
        `• **Excitación DNa02 (Estribor):** ${s.motorActuator.dna02Excitation.toFixed(2)}\n` +
        `• **Pulsos Hápticos Despachados:** ${s.motorActuator.totalPulsesDispatched}\n` +
        `• **Navegación en Sigilo:** Permite avance táctico nocturno sin encender la pantalla hacia el Home Vector o Goal Vector.`;
    }

    // Consulta sobre Feromonas de Enjambre y Estigmergia
    if (/feromona|pheromone|estigmergia|rastro|enjambre.*olor|alerta.*zona/i.test(cleanQ)) {
      return `🍄 **Estigmergia de Malla & Feromonas de Enjambre (Mushroom Body)**\n\n` +
        `• **Feromonas Activas en Memoria:** ${s.mushroomBody.activePheromonesCount}\n` +
        `• **Propensión Conductual:** **${s.mushroomBody.behavioralDrive}** (${s.mushroomBody.behavioralValenceScore})\n` +
        `• **Dinámica de Desvío:** Las feromonas ALARM deprimen la conductancia sináptica de la ruta, provocando evasión automática del tráfico en el sector hostil.\n` +
        `• **Emisión:** Puedes difundir feromonas ALARM, TRAIL o AGGREGATION desde el Mapa Táctico o el Centro de Comando.`;
    }

    // Consulta específica sobre navegación vectorial 3D / Retorno a Casa
    if (/home.*vector|retorno|volver|nido|casa|odometr|fan.*shaped|rumbo.*casa/i.test(cleanQ)) {
      return `🧭 **Navegación Vectorial 3D Fan-Shaped Body (Retorno a Casa)**\n\n` +
        `• **Distancia al Punto de Partida:** ${s.fanShapedBody.homeDistanceMeters} metros\n` +
        `• **Rumbo Azimutal de Retorno:** ${s.fanShapedBody.homeBearingDeg}° (${s.fanShapedBody.homeCardinal})\n` +
        `• **Distancia Total Recorrida:** ${s.fanShapedBody.totalDistanceTraveledMeters} metros\n` +
        `• **Posición Relativa:** X=${s.fanShapedBody.position.x}m (Este), Y=${s.fanShapedBody.position.y}m (Norte), Z=${s.fanShapedBody.position.z}m (Altitud Barométrica)\n` +
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
